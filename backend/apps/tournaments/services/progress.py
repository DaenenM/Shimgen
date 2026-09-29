"""What happens to a tournament after a result changes."""

from django.db import models
from django.utils import timezone

from ..models import Tournament
from .stats_link import award_linked_stats


def settle_state(tournament):
    """
    Bring the tournament's state in line with what its matches actually say.

    Both directions, which is the point. Completion is a fact about the bracket
    — nothing left to play — not a milestone it passes once and keeps. Undoing
    the final makes that fact untrue again, and a bracket still badged complete
    with an unplayed final misreports itself everywhere it appears: the pill,
    the tournaments list, the winner on its card.

    Reopening also lets the linked board give a trophy back. `sync_linked_stats`
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

        award_linked_stats(tournament)
        return

    if not finished and tournament.state == Tournament.State.COMPLETE:
        # Back to active rather than draft: the bracket exists and has results
        # in it, so there is nothing to re-generate — one match is simply open
        # again.
        tournament.state = Tournament.State.ACTIVE
        tournament.completed_at = None
        tournament.save(update_fields=["state", "completed_at", "updated_at"])
