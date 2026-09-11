"""Tournament endpoints: generation, reporting, spectating and claiming."""

import secrets

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import are_friends
from apps.common.permissions import CanReportResults, IsTournamentHost, _is_host, is_unclaimed
from apps.groups.models import Player

from .brackets.advance import ResultError, clear_result, report_result
from .brackets.double_elimination import generate_double_elimination
from .brackets.ffa import generate_ffa, next_ffa_round, report_ffa_result
from .brackets.round_robin import generate_round_robin
from .brackets.seeding import seed_entrants
from .brackets.single_elimination import generate_single_elimination
from .brackets.swiss import generate_swiss, pair_next_round
from .models import Entrant, Match, Participation, Role, Tournament
from .ratings import apply_match_result
from .restage import restage_tournament
from .serializers import (
    BatchReportSerializer,
    CreateTournamentSerializer,
    EntrantSerializer,
    MatchSerializer,
    ReportFFASerializer,
    ReportResultSerializer,
    SpectatorSerializer,
    TournamentDetailSerializer,
    TournamentSerializer,
)
from .standings import standings_payload
from .teams import TeamGenerationError, generate_teams


class TournamentViewSet(viewsets.ModelViewSet):
    """Tournaments the signed-in user hosts, co-hosts or plays in."""

    serializer_class = TournamentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        # Every relation the detail serializer touches is pulled here. Without
        # the nested ones a bracket costs ~4 queries per match — each card asks
        # separately who A, B and the winner are, and who reported it — so a
        # 28-match double elimination ran 60+ round trips per render. They are
        # already in `entrants`; this just stops Django fetching them again.
        base = Tournament.objects.select_related(
            "mode",
            "created_by",
            # The list says whether deleting a row would touch a board, which is
            # one query per row without this. The detail page goes further and
            # names the board, so the table and board it hangs off are pulled
            # too — otherwise naming it costs two more queries per row than the
            # boolean ever did.
            "stats_link",
            "stats_link__table__board",
            "stats_link__column__table__board",
        ).prefetch_related(
            "entrants",
            "entrants__players",
            "roles",
            "roles__user",
            "matches__a",
            "matches__b",
            "matches__winner",
            "matches__reported_by",
            "matches__ffa_results__entrant",
        )

        # An unclaimed quick-start bracket has no owner, so an ownership filter
        # excludes it from its own creator. Without this the anonymous flow
        # creates a tournament and then 404s on the redirect to it — which is
        # the entire front door of the product (plan §4, NEW 6).
        #
        # Safe to expose: these have no owner to protect, and the id is only
        # known to whoever just made it or was handed the link. Anything
        # sensitive is gated by `can_report` / `is_host` on the serializer, and
        # writes still go through IsTournamentHost.
        #
        # Scoped to single-object actions only. Folding it into `list` would put
        # every stranger's unclaimed bracket in everyone's tournament list.
        unclaimed = models.Q(created_by__isnull=True)
        by_id = self.action not in ("list",)

        if not user.is_authenticated:
            return base.filter(unclaimed) if by_id else base.none()

        mine = (
            models.Q(created_by=user)
            | models.Q(roles__user=user)
            | models.Q(entrants__participations__user=user)
        )

        queryset = base.filter(mine | unclaimed if by_id else mine).distinct()

        # Archived tournaments are hidden from the list but still reachable by
        # id, so a link to one keeps working and the page can offer to restore
        # it. `?archived=true` is what the list's own toggle asks for.
        if self.action == "list":
            wants_archived = self.request.query_params.get("archived") == "true"
            queryset = queryset.filter(archived=wants_archived)

        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return CreateTournamentSerializer
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentSerializer

    def get_permissions(self):
        # `create` is deliberately open: the no-account quick start is the whole
        # point of the front door (plan §4, NEW 6), and an anonymous bracket is
        # protected by its claim token rather than by a login.
        if self.action in ("update", "partial_update", "destroy", "generate", "reset"):
            return [IsTournamentHost()]
        # Restaging creates a tournament owned by the caller, so it needs an
        # account to own it — the anonymous quick-start path has nowhere to put
        # the clone.
        if self.action == "restage":
            return [IsAuthenticated()]
        if self.action in ("list", "retrieve", "create", "claim", "standings"):
            return [AllowAny()]
        # Same rule as reporting one result: host, co-host or linked player —
        # and an unclaimed quick-start bracket stays reportable signed out, or
        # the no-account path could build a bracket and never run it.
        if self.action == "batch_report":
            return [CanReportResults()]
        return [IsAuthenticated()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        labels = serializer.validated_data.pop("entrant_labels", [])
        teams = serializer.validated_data.pop("entrant_teams", [])
        seeding = serializer.validated_data.pop("seeding", "random")

        tournament = serializer.save(
            created_by=request.user if request.user.is_authenticated else None
        )

        # An anonymous quick-start bracket gets a claim token so it can be
        # attached to an account later (plan §7, v1). Written after save rather
        # than passed to it: claim_token is not a serializer field, so save()
        # would silently drop the kwarg.
        if not request.user.is_authenticated:
            tournament.claim_token = secrets.token_hex(16)
            tournament.save(update_fields=["claim_token"])

        if request.user.is_authenticated:
            Role.objects.create(tournament=tournament, user=request.user, role=Role.Kind.HOST)

        if teams:
            _create_team_entrants(tournament, teams, request.user)
            _generate(tournament, seeding)
        elif labels:
            _create_entrants(tournament, labels, request.user)
            _generate(tournament, seeding)

        _add_cohosts(tournament, request.data.get("cohosts") or [], request.user)

        _link_stats(
            tournament,
            request.data.get("stats_board"),
            request.data.get("stats_table"),
            request.data.get("stats_column"),
            request.user,
        )

        return Response(
            TournamentDetailSerializer(tournament, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        """
        Build the match graph.

        Refuses once the tournament is active unless `force` is passed, because
        regenerating clears every reported result. The client asks for
        confirmation first (plan §8) rather than silently wiping the night.
        """
        tournament = self.get_object()

        if tournament.state != Tournament.State.DRAFT and not request.data.get("force"):
            raise ValidationError(
                "This tournament has already started. Regenerating clears every "
                "reported result — pass force to confirm."
            )

        tournament.matches.all().delete()
        _generate(tournament, request.data.get("seeding", "random"))

        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """Move from draft to active, locking the entrant list for brackets."""
        tournament = self.get_object()

        if not tournament.matches.exists():
            raise ValidationError("Generate the bracket before starting.")

        tournament.state = Tournament.State.ACTIVE
        tournament.started_at = timezone.now()
        tournament.save(update_fields=["state", "started_at", "updated_at"])

        return Response(self.get_serializer(tournament).data)

    @action(detail=True, methods=["get"])
    def standings(self, request, pk=None):
        """Computed from Match rows on every call — never stored."""
        return Response(standings_payload(self.get_object()))

    @action(detail=True, methods=["post"])
    def entrants(self, request, pk=None):
        """
        Add an entrant, honouring the late-join rules.

        An elimination bracket is a fixed tree: inserting a node means rebuilding
        it, which clears results. Rather than doing that silently, this refuses
        and tells the caller why (plan §3, §8).
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can add entrants.")

        if not tournament.accepts_late_entrants:
            raise ValidationError(
                "This bracket has already started and its shape is fixed. "
                "Regenerate it (clearing results) or add them to a future event."
            )

        serializer = EntrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        last_round = tournament.matches.aggregate(models.Max("round_no"))["round_no__max"] or 0
        entrant = serializer.save(
            tournament=tournament,
            # >0 marks a late entry, so standings can show they played fewer rounds.
            joined_round=0 if tournament.state == Tournament.State.DRAFT else last_round,
        )
        _link_participants(entrant)

        return Response(
            EntrantSerializer(entrant, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "entrant_id", int, OpenApiParameter.PATH, description="Entrant to replace."
            )
        ]
    )
    @action(detail=True, methods=["post"], url_path="entrants/(?P<entrant_id>[^/.]+)/substitute")
    def substitute(self, request, pk=None, entrant_id=None):
        """
        Swap the person in a slot, keeping the bracket and results intact
        (plan §4, NEW 11).

        The slot persists; only who occupies it changes. This is what happens
        when someone rage-quits or their internet dies mid-tournament.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can substitute entrants.")

        entrant = tournament.entrants.filter(pk=entrant_id).first()
        if entrant is None:
            raise ValidationError("No such entrant in this tournament.")

        label = request.data.get("label")
        if not label:
            raise ValidationError({"label": "A replacement name is required."})

        entrant.label = label
        entrant.players.set(request.data.get("player_ids", []))
        entrant.save(update_fields=["label", "updated_at"])
        _link_participants(entrant)

        return Response(EntrantSerializer(entrant, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="next-round")
    def next_round(self, request, pk=None):
        """
        Pair the next round.

        Only Swiss and FFA need this — every other format's graph is complete
        from generation.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can advance the round.")

        if tournament.format == Tournament.Format.SWISS:
            created = pair_next_round(tournament)
        elif tournament.format == Tournament.Format.FFA:
            created = next_ffa_round(tournament)
        else:
            raise ValidationError("This format generates every round up front.")

        if not created:
            raise ValidationError("There are no further rounds to play.")

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

        _settle_state(tournament)
        _sync_linked_stats(tournament)

        # The whole bracket comes back, so the flush doubles as the reconcile
        # the client would otherwise have to request separately.
        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="stats-board")
    def link_stats_board(self, request, pk=None):
        """
        Point this tournament at a stats board, or move it to another one.

        The board is chosen when a tournament is created, but that is exactly
        the moment a host is least likely to have thought about it — the bracket
        is the thing they came for. Without this the choice was final: a night
        that should have counted towards the league simply did not, and the only
        fix was to run it again.

        Posting an empty `stats_board` unlinks. Linking a board that is already
        linked is a no-op rather than an error, so a double-tap on a phone
        cannot strip the board and put it back.

        `stats_table` names one table on a board directly, which is what a board
        with a Solo and a Teams table needs — picking the board alone lets the
        server choose, and it cannot know which of the two tonight belongs to.

        Numbers are brought up to date immediately: `_link_stats` enrols the
        players and syncs whatever has been played so far, so a board linked
        halfway through a night shows that night's results rather than only the
        ones reported after the link.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can change the stats board.")

        slug = request.data.get("stats_board") or ""
        table_id = request.data.get("stats_table") or None

        current = getattr(tournament, "stats_link", None)
        current_slug = None
        current_table_id = None
        if current is not None and current.stats_table is not None:
            current_slug = current.stats_table.board.slug
            current_table_id = current.stats_table.id

        if table_id:
            # Compared as strings: the id arrives from JSON as either, and a
            # mismatch here would relink on every request — stripping the
            # night's numbers off and putting them straight back.
            if str(table_id) != str(current_table_id):
                _link_stats(tournament, None, table_id, None, request.user)
        elif slug:
            if slug != current_slug:
                _link_stats(tournament, slug, None, None, request.user)
        else:
            _unlink_stats(tournament)

        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def restage(self, request, pk=None):
        """
        Run it back: a fresh draft with the same entrants, named as the next in
        the series.

        The crew that plays the same night every week was retyping eight team
        names and their rosters each time, and the alternative — regenerating
        the original — destroys the record of what already happened.

        `reshuffle` clears the seeds so round one is paired afresh. Without it
        the clone reproduces last week's matchups exactly, which is what a
        rematch means.

        Host-only: a clone carries the co-hosts and the board link over, which
        is a decision about the host's own list rather than about reporting.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can run a tournament back.")

        clone = restage_tournament(
            tournament,
            user=request.user,
            reshuffle=bool(request.data.get("reshuffle")),
        )

        # The host role is created here rather than in the clone helper, so it
        # follows the same path a freshly created tournament takes.
        if request.user.is_authenticated:
            Role.objects.get_or_create(
                tournament=clone, user=request.user, defaults={"role": Role.Kind.HOST}
            )

        # Generated after the entrants are copied, and with random seeding only
        # when reshuffling — "manual" honours the seeds carried over, which is
        # what reproduces the original's matchups.
        if clone.entrants.count() >= 2:
            _generate(clone, "random" if request.data.get("reshuffle") else "manual")

        clone = self.get_queryset().get(pk=clone.pk)
        return Response(
            TournamentDetailSerializer(clone, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="cohosts")
    def add_cohost(self, request, pk=None):
        """
        Let a trusted friend report results too (plan §4, NEW 12).

        Limited to the host's friends. A co-host can decide who won, which is
        the whole of the night's record — that is not a thing to hand to
        whichever account id happened to be posted.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can add co-hosts.")

        user_id = request.data.get("user")
        if not user_id:
            raise ValidationError({"user": "A user is required."})

        person = get_user_model().objects.filter(pk=user_id).first()
        if person is None:
            raise ValidationError({"user": "No such account."})

        if not are_friends(request.user, person):
            raise ValidationError(
                {"user": "You can only add your friends as co-hosts. Add them as a friend first."}
            )

        role, _ = Role.objects.get_or_create(
            tournament=tournament, user=person, defaults={"role": Role.Kind.COHOST}
        )

        return Response({"id": role.id, "role": role.role}, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path="cohosts/(?P<user_id>[^/.]+)",
    )
    def remove_cohost(self, request, pk=None, user_id=None):
        """
        Take a co-host's permission back.

        Only co-hosts: the host's own role is what makes them the host, and
        deleting it would leave the tournament with nobody able to run it.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can remove co-hosts.")

        role = Role.objects.filter(
            tournament=tournament, user_id=user_id, role=Role.Kind.COHOST
        ).first()

        if role is None:
            raise ValidationError({"user": "They are not a co-host of this tournament."})

        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def favourite(self, request, pk=None):
        """
        Pin this tournament to the top of the list, or unpin it.

        Stamped with the time rather than flagged, so pinning a second one puts
        it below the first instead of competing with it for the top.
        """
        tournament = self.get_object()
        self.check_object_permissions(request, tournament)

        tournament.favourited_at = None if tournament.favourited_at else timezone.now()
        tournament.save(update_fields=["favourited_at", "updated_at"])

        return Response(TournamentSerializer(tournament, context={"request": request}).data)

    def perform_destroy(self, instance):
        """
        Delete the tournament and everything it put on a linked board.

        The link itself cascades away, but the numbers it wrote do not — so
        without this a deleted tournament leaves permanent wins on a board with
        nothing behind them. The client warns about this before confirming.
        """
        _strip_linked_stats(instance)
        instance.delete()

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """
        Put a finished night away without losing it.

        Archiving rather than deleting: the results are part of everyone's
        stats, and a season that is simply over should stop filling the list
        without taking its record with it. Only the host — a co-host can report
        results, not decide what the host sees in their own list.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can archive a tournament.")

        # An archived tournament cannot also be pinned to the top of a list it
        # is no longer in.
        tournament.archived = True
        tournament.favourited_at = None
        tournament.save(update_fields=["archived", "favourited_at", "updated_at"])

        return Response(TournamentSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Bring an archived tournament back into the list."""
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can restore a tournament.")

        tournament.archived = False
        tournament.save(update_fields=["archived", "updated_at"])

        return Response(TournamentSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def claim(self, request, pk=None):
        """
        Attach an anonymous quick-start bracket to the signed-in account.

        The secret token is the proof of ownership — whoever built it holds the
        URL, and nobody else can guess a 32-character hex string.
        """
        # Not self.get_object(): an unclaimed bracket has no owner, so it is
        # outside the user's queryset by definition. The claim token is what
        # proves the caller built it.
        tournament = Tournament.objects.filter(pk=pk).first()
        if tournament is None:
            raise ValidationError("No such tournament.")

        if not request.user.is_authenticated:
            raise PermissionDenied("Sign in to claim this tournament.")

        if not tournament.claim_token:
            raise ValidationError("This tournament has already been claimed.")

        if not secrets.compare_digest(tournament.claim_token, str(request.data.get("token", ""))):
            raise PermissionDenied("That claim link is not valid.")

        tournament.created_by = request.user
        tournament.claim_token = ""
        tournament.save(update_fields=["created_by", "claim_token", "updated_at"])

        Role.objects.get_or_create(
            tournament=tournament, user=request.user, defaults={"role": Role.Kind.HOST}
        )

        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    """Reporting results. Reads follow the tournament's own visibility."""

    serializer_class = MatchSerializer
    permission_classes = [CanReportResults]

    def get_queryset(self):
        return Match.objects.select_related("a", "b", "winner", "tournament")

    @action(detail=True, methods=["post"])
    def report(self, request, pk=None):
        """
        Record a head-to-head result and advance both sides.

        Ratings are applied here rather than on a schedule so the leaderboard is
        correct the moment the score is entered.
        """
        match = self.get_object()
        self.check_object_permissions(request, match)

        serializer = ReportResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            report_result(
                match,
                score_a=serializer.validated_data["score_a"],
                score_b=serializer.validated_data["score_b"],
                reported_by=request.user if request.user.is_authenticated else None,
            )
        except ResultError as exc:
            raise ValidationError(str(exc)) from exc

        match.refresh_from_db()
        if match.winner_id:
            apply_match_result(match)

        _settle_state(match.tournament)
        _sync_linked_stats(match.tournament)

        return Response(MatchSerializer(match, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="report-ffa")
    def report_ffa(self, request, pk=None):
        """Record a free-for-all lobby's finishing order."""
        match = self.get_object()
        self.check_object_permissions(request, match)

        serializer = ReportFFASerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        placements = {int(k): int(v) for k, v in serializer.validated_data["placements"].items()}

        try:
            report_ffa_result(
                match,
                placements,
                reported_by=request.user if request.user.is_authenticated else None,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        match.refresh_from_db()
        return Response(MatchSerializer(match, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def clear(self, request, pk=None):
        """Undo a result, including everything it advanced."""
        match = self.get_object()
        self.check_object_permissions(request, match)

        clear_result(match)
        match.refresh_from_db()

        # Before the stats sync: reopening the tournament is what lets the board
        # give back a trophy awarded for a result that no longer stands.
        _settle_state(match.tournament)
        _sync_linked_stats(match.tournament)

        return Response(MatchSerializer(match, context={"request": request}).data)


class SpectatorView(RetrieveAPIView):
    """
    The public bracket (plan §4, NEW 2).

    No account required: the organiser signs up, nine friends just click a link.
    That is the entire acquisition channel, so this must stay open.
    """

    serializer_class = SpectatorSerializer
    permission_classes = [AllowAny]
    lookup_field = "public_slug"
    # Same nested prefetches as the host view: a spectator renders the same
    # bracket, and this is the page strangers land on from a shared link.
    queryset = Tournament.objects.select_related("mode", "created_by").prefetch_related(
        "entrants",
        "entrants__players",
        "roles",
        "roles__user",
        "matches__a",
        "matches__b",
        "matches__winner",
        "matches__reported_by",
        "matches__ffa_results__entrant",
    )


@extend_schema(
    responses={200: dict},
    description="Standings for a public bracket, computed from its match rows.",
)
class SpectatorStandingsView(APIView):
    """Standings for a public bracket, same open access as the bracket itself."""

    permission_classes = [AllowAny]
    serializer_class = None

    def get(self, request, public_slug):
        tournament = Tournament.objects.filter(public_slug=public_slug).first()
        if tournament is None:
            raise ValidationError("No tournament with that link.")
        return Response(standings_payload(tournament))


class TeamGeneratorView(APIView):
    """
    Generate balanced teams (plan §3).

    Open to anonymous callers: the team generator is useful with a pasted list
    of names and no account, which is half the reason people arrive.
    """

    permission_classes = [AllowAny]
    serializer_class = None

    @extend_schema(request=dict, responses={200: dict})
    def post(self, request):
        names = request.data.get("names") or []
        player_ids = request.data.get("player_ids") or []
        team_count = int(request.data.get("team_count") or 2)
        balance = request.data.get("balance", "random")
        avoid = request.data.get("avoid") or None

        players, ratings = _resolve_players(request, names, player_ids, balance)

        if len(players) < 2:
            raise ValidationError("At least two players are needed.")

        constraints = _parse_constraints(request.data.get("constraints") or [], players)

        try:
            teams = generate_teams(
                players,
                team_count,
                constraints=constraints,
                balance=balance,
                ratings=ratings,
                avoid=avoid,
            )
        except TeamGenerationError as exc:
            raise ValidationError(str(exc)) from exc

        return Response(
            {
                "teams": [
                    [{"id": p.id, "name": getattr(p, "display_name", p.name)} for p in team]
                    for team in teams
                ],
                # Two teams is a series, not a bracket — a bracket for two is
                # just ceremony (plan §3).
                "suggest_series": len(teams) == 2,
            }
        )


# ── Helpers ───────────────────────────────────────────────────────────────────


class _AdHoc:
    """A name with no roster entry behind it, shaped like a Player."""

    def __init__(self, index, name):
        self.id = -(index + 1)  # negative, so it cannot collide with a real row
        self.display_name = name
        self.name = name


def _resolve_players(request, names, player_ids, balance):
    """Turn the request's names and roster ids into objects the generator takes."""
    players = []
    ratings = {}

    if player_ids and request.user.is_authenticated:
        roster = list(Player.objects.filter(owner=request.user, id__in=player_ids))
        players.extend(roster)

        if balance == "rating":
            from .models import Rating

            mode_id = request.data.get("mode")
            rating_rows = Rating.objects.filter(player__in=roster)
            if mode_id:
                rating_rows = rating_rows.filter(mode_id=mode_id)
            ratings = {r.player_id: r.elo for r in rating_rows}

    players.extend(_AdHoc(i, name.strip()) for i, name in enumerate(names) if name.strip())

    return players, ratings


def _parse_constraints(raw, players):
    """
    Build Constraint objects from the request payload.

    Rules may name their players (`player_names`) instead of carrying ids.
    Names are what the caller actually has for an ad-hoc list, and they survive
    the roster being edited: positional ids silently changed meaning whenever a
    name was removed or reordered, so a "keep apart" rule would either point at
    the wrong pair or at nobody at all — and a rule matching nobody passes
    vacuously, which is how two people who must not play together ended up on
    the same team.

    A rule that names someone no longer in the list is dropped rather than
    quietly weakened, so it cannot half-apply.
    """
    from .teams import Constraint

    # A name can be worn by more than one person — two Alexes in one group is
    # ordinary — so a name maps to every id holding it. A rule about "Alex"
    # then covers both, which is the only safe reading: applying it to whichever
    # Alex happened to be listed first left the other unconstrained, and the
    # pair landed together on roughly half the rolls.
    by_name: dict[str, list[int]] = {}
    for player in players:
        name = getattr(player, "display_name", None) or getattr(player, "name", "")
        by_name.setdefault(name.strip().casefold(), []).append(player.id)

    rules = []

    for item in raw:
        if not item.get("kind"):
            continue

        names = item.get("player_names")
        if names:
            resolved = [by_name.get(str(n).strip().casefold()) for n in names]
            # Every named player must still be present, or the rule is not the
            # rule the caller wrote.
            if any(ids is None for ids in resolved):
                continue
            player_ids = [pid for ids in resolved for pid in ids]
            # Keep the sides, so APART separates the named people from each
            # other rather than separating two namesakes.
            groups = resolved if item["kind"] == "apart" else None
        else:
            player_ids = item.get("player_ids") or []
            groups = None

        rules.append(
            Constraint(
                kind=item["kind"],
                player_ids=player_ids,
                team_index=item.get("team_index"),
                groups=groups,
            )
        )

    return rules


def acts_as_host(tournament, user) -> bool:
    """
    Whether `user` may take host actions on `tournament`.

    An unclaimed quick-start bracket has no owner, so whoever holds it is
    effectively its host — otherwise someone could build a bracket anonymously
    and then be unable to add an entrant to it.
    """
    return is_unclaimed(tournament) or _is_host(tournament, user)


def _create_entrants(tournament, labels, user=None):
    """
    Create entrants from a pasted list of names.

    In solo mode an entrant *is* a person, so each name is attached as a Player
    the same way a team's members are. Without that a linked stats board has
    nobody to track: it counts by player, and a bracket of bare labels has none
    — which showed up as a board that stayed empty all night.

    An anonymous host has no roster to attach to, so their entrants stay labels.
    That is the trade the no-account path makes.
    """
    created = []

    for index, label in enumerate(labels, start=1):
        label = str(label).strip()
        if not label:
            continue

        entrant = Entrant.objects.create(tournament=tournament, label=label, seed=index)
        created.append(entrant)

        if user is not None and user.is_authenticated:
            entrant.players.add(_player_named(user, label))
            _link_participants(entrant)

    return created


def _player_named(user, name):
    """This host's roster entry for `name`, created if they have none."""
    # Case-insensitive match, then create. get_or_create cannot be used with an
    # __iexact lookup: it would pass that through to the model constructor on
    # the create branch and raise.
    player = Player.objects.filter(owner=user, display_name__iexact=name).first()
    if player is None:
        player = Player.objects.create(owner=user, display_name=name)

    return player


def _create_team_entrants(tournament, teams, user):
    """
    Create entrants that are squads, attaching each member as a Player.

    Members are matched against the host's existing roster by name before a new
    Player is created, so sending the same crew to a second bracket links to the
    people already there rather than duplicating them — which would split one
    person's stats across two rows.

    For an anonymous host there is no roster to attach to, so the team is stored
    as a label alone and its members are lost. That is the trade the no-account
    path makes: nothing to own the Player rows.
    """
    created = []

    for index, team in enumerate(teams, start=1):
        entrant = Entrant.objects.create(
            tournament=tournament, label=str(team["label"]).strip(), seed=index
        )
        created.append(entrant)

        if not user.is_authenticated:
            continue

        for name in team.get("members") or []:
            name = str(name).strip()
            if not name:
                continue

            entrant.players.add(_player_named(user, name))

        _link_participants(entrant)

    return created


def _generate(tournament, seeding="random"):
    """Dispatch to the right generator for this tournament's format."""
    entrants = seed_entrants(list(tournament.entrants.all()), seeding)

    if len(entrants) < 2:
        raise ValidationError("A tournament needs at least two entrants.")

    fmt = tournament.format

    if fmt == Tournament.Format.SINGLE:
        generate_single_elimination(tournament, entrants, third_place=tournament.third_place_match)
    elif fmt == Tournament.Format.DOUBLE:
        generate_double_elimination(tournament, entrants, third_place=tournament.third_place_match)
    elif fmt == Tournament.Format.ROUND_ROBIN:
        generate_round_robin(
            tournament,
            entrants,
            double_round=bool((tournament.settings or {}).get("double_round")),
        )
    elif fmt == Tournament.Format.SWISS:
        generate_swiss(tournament, entrants)
    elif fmt == Tournament.Format.FFA:
        generate_ffa(tournament, entrants)

    # Re-seed in the order actually used, so the bracket and the entrant list
    # agree about who is seed 1.
    for index, entrant in enumerate(entrants, start=1):
        entrant.seed = index
    Entrant.objects.bulk_update(entrants, ["seed"])


def _link_participants(entrant):
    """
    Create Participation rows for entrants backed by a real account.

    This is what lets a player see events they have been added to and leave one
    (plan §8) — consent recorded from the start rather than retrofitted.
    """
    for player in entrant.players.all():
        if player.user_id:
            Participation.objects.get_or_create(entrant=entrant, user_id=player.user_id)


def _add_cohosts(tournament, user_ids, host):
    """
    Give a few friends reporting rights as the bracket is created.

    Doing it here rather than only afterwards is the difference between the host
    being the sole bottleneck for entering scores all night and not (plan §4,
    NEW 12) — by the time the first match ends, nobody wants to be in a settings
    screen.

    Anyone who is not the host's friend is skipped rather than failing the whole
    creation: losing a bracket because one name in a list was stale would be a
    poor trade.
    """
    if not user_ids or not host.is_authenticated:
        return

    people = get_user_model().objects.filter(pk__in=user_ids)

    for person in people:
        if person.id == host.id or not are_friends(host, person):
            continue

        Role.objects.get_or_create(
            tournament=tournament, user=person, defaults={"role": Role.Kind.COHOST}
        )


def _link_stats(tournament, board_slug, table_id, column_id, user):
    """
    Point this tournament at a stats board.

    Naming the board is enough: the columns a tournament fills are fixed, so the
    board itself knows where its results go. `stats_table` and `stats_column`
    remain for callers that want to name a specific one — an older client, or a
    board with several tables — but the host picking "League" from a list does
    not have to answer a second question about it.

    Gated on edit rights: linking writes onto someone else's board, so it needs
    the same permission tallying by hand does. A target the caller may not write
    to is refused outright rather than silently dropped — a host who thinks the
    night is being counted and finds out later that it was not is worse off than
    one told now.

    Players are enrolled immediately rather than at the final whistle. The board
    should show tonight's line-up while the night is still going, and a name that
    only appears on victory makes the table useless as a team sheet.
    """
    if not board_slug and not table_id and not column_id:
        return

    from apps.stats.awarding import (
        enrol_tournament_players,
        ensure_automatic_columns,
        sync_tournament_stats,
    )
    from apps.stats.models import BoardLink, StatsBoard, StatsColumn, StatsTable

    if board_slug:
        board = StatsBoard.objects.filter(slug=board_slug).select_related("owner").first()
        if board is None:
            raise ValidationError({"stats_board": "No such stats board."})

        table = _tournament_table_for(board)
        target = {"table": table}
    elif table_id:
        table = StatsTable.objects.filter(pk=table_id).select_related("board__owner").first()
        if table is None:
            raise ValidationError({"stats_table": "No such stats table."})
        target, board = {"table": table}, table.board
    else:
        column = (
            StatsColumn.objects.filter(pk=column_id).select_related("table__board__owner").first()
        )
        if column is None:
            raise ValidationError({"stats_column": "No such stats column."})
        target, board = {"column": column}, column.table.board

    if not board.may_edit(user):
        raise ValidationError(
            {"stats_board": "You do not have permission to add to that stats board."}
        )

    # A board picked by name may have been made for hand-counting. Rather than
    # refuse the link, give its table the columns a tournament needs — the host
    # asked for this night to count, and that is the thing that makes it count.
    if board_slug:
        ensure_automatic_columns(target["table"])

    # Re-linking is a move, not a second link: `BoardLink.tournament` is
    # one-to-one. The old board keeps whatever other tournaments gave it, but
    # this tournament's contribution comes off it first — otherwise switching
    # boards would leave tonight's wins sitting on a board it no longer feeds.
    _unlink_stats(tournament)

    link = BoardLink.objects.create(tournament=tournament, **target)

    enrol_tournament_players(link)
    sync_tournament_stats(link)


def _tournament_table_for(board):
    """
    The table on `board` that a tournament should feed.

    Prefers one already tracking tournaments; otherwise the first table, which
    is the only one on the overwhelming majority of boards. A board with no
    table at all gets one, since every board is created with one and this is
    only reachable if somebody deleted it.
    """
    from apps.stats.models import StatsColumn, StatsTable

    tables = list(board.tables.prefetch_related("columns"))

    for table in tables:
        if any(column.role != StatsColumn.Role.MANUAL for column in table.columns.all()):
            return table

    if tables:
        return tables[0]

    return StatsTable.objects.create(board=board, name="Tournaments", position=0)


def _settle_state(tournament):
    """
    Bring the tournament's state in line with what its matches actually say.

    Both directions, which is the point. Completion is a fact about the bracket
    — nothing left to play — not a milestone it passes once and keeps. Undoing
    the final makes that fact untrue again, and a bracket still badged complete
    with an unplayed final misreports itself everywhere it appears: the pill,
    the tournaments list, the winner on its card.

    Reopening also lets the linked board give a trophy back. `_sync_linked_stats`
    retracts an award whose result no longer stands, and it can only do that
    while the tournament is live.
    """
    finished = (
        not tournament.matches.filter(winner__isnull=True)
        .exclude(models.Q(a__isnull=True) | models.Q(b__isnull=True))
        .exists()
    )

    if finished and tournament.state != Tournament.State.COMPLETE:
        tournament.state = Tournament.State.COMPLETE
        tournament.completed_at = timezone.now()
        tournament.save(update_fields=["state", "completed_at", "updated_at"])

        _award_linked_stats(tournament)
        return

    if not finished and tournament.state == Tournament.State.COMPLETE:
        # Back to active rather than draft: the bracket exists and has results
        # in it, so there is nothing to re-generate — one match is simply open
        # again.
        tournament.state = Tournament.State.ACTIVE
        tournament.completed_at = None
        tournament.save(update_fields=["state", "completed_at", "updated_at"])


def _award_linked_stats(tournament):
    """
    Credit the winners on a linked stats board, if there is one.

    Imported here rather than at module scope: tournaments know nothing about
    boards, and keeping it that way means the stats app can be removed without
    touching the bracket engine. Awarding is idempotent, so a corrected result
    that re-completes the tournament does not hand out a second set of marks.
    """
    from apps.stats.awarding import apply_tournament_result

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        apply_tournament_result(link)


def _unlink_stats(tournament):
    """
    Detach this tournament from whatever board it feeds.

    Takes its numbers off that board on the way out, exactly as deleting the
    tournament does — the contribution and the link are one thing, and leaving
    one without the other is what makes a board stop being trustworthy.

    Returns True when there was something to detach, so a caller can tell
    "unlinked" from "was never linked".
    """
    from apps.stats.awarding import strip_tournament_from_board

    link = getattr(tournament, "stats_link", None)
    if link is None:
        return False

    strip_tournament_from_board(link)
    link.delete()

    # The cached relation still points at the deleted row, and `_link_stats`
    # checks it immediately afterwards when this is a switch rather than a
    # removal.
    try:
        del tournament.stats_link
    except AttributeError:
        pass

    return True


def _strip_linked_stats(tournament):
    """
    Undo this tournament's contribution to a linked board.

    Imported here rather than at module scope, like the other two: tournaments
    know nothing about boards, and keeping it that way means the stats app can
    be removed without touching the bracket engine.
    """
    from apps.stats.awarding import strip_tournament_from_board

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        strip_tournament_from_board(link)


def _sync_linked_stats(tournament):
    """
    Update a linked board's per-game numbers.

    Called after a result is reported *and* after one is cleared, because the
    counts are recomputed from the match rows rather than incremented — undoing
    a win has to walk the board back down as readily as reporting one walked it
    up.
    """
    from apps.stats.awarding import sync_tournament_stats

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        sync_tournament_stats(link)
