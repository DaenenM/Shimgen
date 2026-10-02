"""Tournament-specific permission checks."""

from rest_framework.permissions import BasePermission

from common.permissions import _is_host, is_unclaimed


def acts_as_host(tournament, user) -> bool:
    """
    Whether `user` may take host actions on `tournament`.

    An unclaimed quick-start bracket has no owner, so whoever holds it is
    effectively its host — otherwise someone could build a bracket anonymously
    and then be unable to add an entrant to it.
    """
    return is_unclaimed(tournament) or _is_host(tournament, user)


class CanPickInDraft(BasePermission):
    """
    Taking a turn in a captain draft: the host, or the captain whose turn it is.

    The host can always pick, because the ordinary case is one device being
    passed around a table and the host tapping for whoever is up. A captain with
    a linked account may also pick — but only on their own turn, which is what
    makes a shared lobby safe: there is no way to take someone else's pick, so
    nobody has to trust the room to behave.

    Deliberately not a co-host grant. Reporting a result is a clerical act
    somebody else can do for you; choosing who is on your team is not.
    """

    message = "It is not your turn to pick."

    def has_object_permission(self, request, view, obj):
        tournament = obj if hasattr(obj, "roles") else getattr(obj, "tournament", None)
        if tournament is None:
            return False

        # An unclaimed quick-start draft belongs to whoever is holding it, the
        # same bargain every other anonymous action strikes.
        if is_unclaimed(tournament):
            return True

        if _is_host(tournament, request.user):
            return True

        if not request.user.is_authenticated:
            return False

        draft = getattr(tournament, "team_draft", None)
        if draft is None or draft.is_complete:
            return False

        position = draft.current_team_index
        if position is None:
            return False

        return draft.teams.filter(position=position, captain_user=request.user).exists()
