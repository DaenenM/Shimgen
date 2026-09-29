"""Running the bracket: generating, starting, reporting, entrants, standings.

Mixed into TournamentViewSet (views/tournament.py).
"""

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from ..brackets.advance import ResultError, clear_result, report_result
from ..brackets.swiss import pair_next_round
from ..models import Match, Tournament
from ..permissions import acts_as_host
from ..serializers import (
    BatchReportSerializer,
    MatchSerializer,
    TournamentDetailSerializer,
)
from ..services.broadcast import broadcast_tournament
from ..services.progress import settle_state
from ..services.ratings import apply_match_result
from ..services.standings import standings_payload
from ..services.stats_link import sync_linked_stats


class BracketActionsMixin:
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """Move from draft to active, locking the entrant list for brackets."""
        tournament = self.get_object()

        if not tournament.matches.exists():
            raise ValidationError("Generate the bracket before starting.")

        tournament.state = Tournament.State.ACTIVE
        tournament.started_at = timezone.now()
        tournament.save(update_fields=["state", "started_at", "updated_at"])

        broadcast_tournament(tournament.id)

        return Response(self.get_serializer(tournament).data)

    @action(detail=True, methods=["get"])
    def standings(self, request, pk=None):
        """Computed from Match rows on every call — never stored."""
        return Response(standings_payload(self.get_object()))

    @action(detail=True, methods=["post"], url_path="next-round")
    def next_round(self, request, pk=None):
        """
        Pair the next round.

        Only Swiss needs this — every other format's graph is complete from
        generation.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can advance the round.")

        if tournament.format != Tournament.Format.SWISS:
            raise ValidationError("This format generates every round up front.")

        created = pair_next_round(tournament)

        if not created:
            raise ValidationError("There are no further rounds to play.")

        broadcast_tournament(tournament.id)

        return Response(
            MatchSerializer(created, many=True, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=BatchReportSerializer,
        responses={200: TournamentDetailSerializer},
        description="Apply a run of results in one request. Order is preserved.",
    )
    @action(detail=True, methods=["post"], url_path="batch-report")
    def batch_report(self, request, pk=None):
        """
        Apply several results at once.

        The client reports optimistically and flushes a queue of clicks rather
        than sending one request per click — a host clicking through a round
        used to mean a request and a bracket refetch each time.

        Two properties this relies on:

        - **Order is preserved.** A later entry may correct an earlier one
          (a mis-click handed to the other side), and advancement depends on
          what came before, so the run is replayed exactly as it was clicked.
        - **It is all-or-nothing.** One atomic block, so a rejected entry
          leaves the bracket exactly as it was rather than half-applied. The
          client resolves the disagreement by refetching, which it does after
          every flush anyway.
        """
        tournament = self.get_object()
        self.check_object_permissions(request, tournament)

        serializer = BatchReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operations = serializer.validated_data["operations"]

        # Checked up front so a match from another tournament is rejected before
        # anything is written. The rows themselves are re-read per operation
        # below — this set is only used to validate ownership.
        wanted = {op["match"] for op in operations}
        owned = set(
            Match.objects.filter(tournament=tournament, id__in=wanted).values_list("id", flat=True)
        )

        missing = wanted - owned
        if missing:
            # A match from another tournament is indistinguishable from one that
            # does not exist, which is deliberate: it leaks nothing either way.
            raise ValidationError(
                f"No such match in this tournament: {', '.join(str(i) for i in sorted(missing))}."
            )

        reporter = request.user if request.user.is_authenticated else None
        decided = []

        try:
            with transaction.atomic():
                for op in operations:
                    # Re-read per operation rather than reusing a snapshot taken
                    # before the run started. An earlier entry may have seated
                    # this very match — clicking through a round sends the
                    # quarterfinals and the semifinal they fill in one batch —
                    # and a stale copy still shows both slots empty, so the
                    # match reads as unplayable and the whole run is rejected.
                    match = Match.objects.select_related("a", "b", "winner", "tournament").get(
                        pk=op["match"]
                    )

                    if op.get("op", "report") == "clear":
                        clear_result(match)
                        continue

                    report_result(
                        match,
                        score_a=op["score_a"],
                        score_b=op["score_b"],
                        reported_by=reporter,
                    )
                    # Re-read before the next entry: advancement may have seated
                    # an entrant in a match still to come in this same run.
                    match.refresh_from_db()
                    if match.winner_id:
                        decided.append(match)
        except ResultError as exc:
            raise ValidationError(str(exc)) from exc

        # Ratings after the transaction commits, and once per match rather than
        # once per entry — a match corrected twice in one batch should not move
        # anyone's rating twice.
        for match in {m.id: m for m in decided}.values():
            apply_match_result(match)

        settle_state(tournament)
        sync_linked_stats(tournament)

        # The whole bracket comes back, so the flush doubles as the reconcile
        # the client would otherwise have to request separately.
        broadcast_tournament(tournament.id)

        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)
