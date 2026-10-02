"""Captain draft lobby actions: view, pick, undo, complete.

Mixed into TournamentViewSet (views/tournament.py).
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..models import Tournament
from ..serializers import (
    TournamentDetailSerializer,
)
from ..services.broadcast import broadcast_draft
from ..services.creation import create_team_entrants, generate_bracket, player_named


class DraftActionsMixin:
    @action(detail=True, methods=["get"], url_path="draft")
    def draft(self, request, pk=None):
        """The lobby as it stands: whose turn, who is left, who has whom."""
        return _draft_response(_draft_or_400(self.get_object()), request)

    @action(detail=True, methods=["post"], url_path="draft/pick")
    def draft_pick(self, request, pk=None):
        """
        Take a player off the pool for whichever team is currently picking.

        The team is taken from the stored order rather than from the request:
        letting the caller name the team would make it possible to pick out of
        turn, which is the one thing a draft cannot allow.
        """
        from ..models import DraftPick

        tournament = self.get_object()
        draft = _draft_or_400(tournament)

        if draft.is_complete:
            raise ValidationError("This draft is already finished.")

        position = draft.current_team_index
        if position is None:
            raise ValidationError("Every player has been picked.")

        label = str(request.data.get("label") or "").strip()
        if not label:
            raise ValidationError("Name the player being picked.")

        pool = [name.lower() for name in (tournament.settings or {}).get("draft_pool", [])]
        taken = {pick.label.lower() for pick in draft.picks.all()}

        if label.lower() not in pool:
            # Covers both "not in this tournament" and "is a captain": captains
            # were removed from the pool when the draft opened, so they simply
            # are not in it.
            raise ValidationError(f"{label} is not in the draft pool.")
        if label.lower() in taken:
            raise ValidationError(f"{label} has already been picked.")

        team = draft.teams.get(position=position)

        with transaction.atomic():
            DraftPick.objects.create(
                draft=draft,
                team=team,
                player=team.captain and player_named(request.user, label)
                if request.user.is_authenticated
                else None,
                label=label,
                ordinal=draft.picks_made,
            )
            draft.picks_made += 1
            draft.save(update_fields=["picks_made", "updated_at"])

        broadcast_draft(draft)

        return _draft_response(draft, request)

    @action(detail=True, methods=["post"], url_path="draft/undo")
    def draft_undo(self, request, pk=None):
        """
        Roll the last pick back.

        A misclick during a draft is the same problem as a misreported result,
        and the answer is the same: make it undoable rather than making people
        careful. Only the most recent pick, so the turn order stays coherent.
        """
        tournament = self.get_object()
        draft = _draft_or_400(tournament)

        if draft.is_complete:
            raise ValidationError("This draft is finished. Undo is no longer available.")

        last = draft.picks.order_by("-ordinal").first()
        if last is None:
            raise ValidationError("Nothing has been picked yet.")

        with transaction.atomic():
            last.delete()
            draft.picks_made = max(0, draft.picks_made - 1)
            draft.save(update_fields=["picks_made", "updated_at"])

        broadcast_draft(draft)

        return _draft_response(draft, request)

    @action(detail=True, methods=["post"], url_path="draft/complete")
    def draft_complete(self, request, pk=None):
        """
        Turn the finished draft into a bracket.

        This is the step where a drafted tournament stops being special: the
        teams become ordinary entrants and the existing generator runs against
        them, so whichever format the host chose works with no draft-specific
        code anywhere in the bracket engine.
        """
        from ..services.drafting import teams_payload

        tournament = self.get_object()
        draft = _draft_or_400(tournament)

        if draft.is_complete:
            raise ValidationError("This draft has already been turned into a bracket.")

        remaining = len(draft.pick_order) - draft.picks_made
        if remaining > 0:
            raise ValidationError(
                f"{remaining} player{'s' if remaining != 1 else ''} still to pick."
            )

        teams = list(draft.teams.prefetch_related("picks"))
        captains = [team.captain_label for team in teams]
        picks_by_team = {team.position: [pick.label for pick in team.picks.all()] for team in teams}
        labels = [team.label for team in teams]

        with transaction.atomic():
            create_team_entrants(
                tournament, teams_payload(captains, picks_by_team, labels), request.user
            )

            # `get_queryset` prefetches `entrants`, and this object was fetched
            # while the draft still had none — so the relation carries an empty
            # cache that `generate_bracket` would read straight through, and refuse to
            # build a bracket for a tournament that now has entrants. Dropping
            # the cache is what makes the rows just created visible.
            #
            # Local to this action on purpose: every other caller of `generate_bracket`
            # works on a freshly saved object with no prefetch behind it, so the
            # fix belongs here rather than inside the generator.
            tournament = Tournament.objects.get(pk=tournament.pk)

            generate_bracket(tournament, request.data.get("seeding", "random"))

            # Back to an ordinary un-started tournament: the bracket exists and
            # the host starts it when the room is ready, exactly as they would
            # have done had they typed the teams in themselves.
            tournament.state = Tournament.State.DRAFT
            draft.completed_at = timezone.now()
            draft.save(update_fields=["completed_at", "updated_at"])
            tournament.save(update_fields=["state", "updated_at"])

        # Tells every watching lobby the draft is over, so they follow through
        # to the bracket instead of sitting on a finished draft.
        broadcast_draft(draft)

        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)


def _draft_or_400(tournament):
    """The draft attached to this tournament, or a clear refusal."""
    draft = getattr(tournament, "team_draft", None)
    if draft is None:
        raise ValidationError("This tournament is not being drafted.")
    return draft


def _draft_response(draft, request):
    from ..serializers import TeamDraftSerializer

    draft.refresh_from_db()
    return Response(TeamDraftSerializer(draft, context={"request": request}).data)
