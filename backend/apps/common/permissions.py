"""
Shared permission classes.

The plan's role model is three-tier (plan §4, NEW 12): host, co-host who may
report results, and spectator, who needs no row at all — it is simply whoever
holds the public link.
"""

from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """Only the object's owner may touch it."""

    message = "This belongs to someone else."

    def has_object_permission(self, request, view, obj):
        owner_id = getattr(obj, "owner_id", None)
        return owner_id is not None and owner_id == request.user.id


class IsTournamentHost(permissions.BasePermission):
    """
    Full control of a tournament: the host, or the group's owner.

    Co-hosts are deliberately excluded — they may report results, not delete the
    event or rewrite its settings.
    """

    message = "Only the host can change this tournament."

    def has_object_permission(self, request, view, obj):
        tournament = obj if hasattr(obj, "roles") else getattr(obj, "tournament", None)
        if tournament is None:
            return False

        # Same reasoning as CanReportResults: an unclaimed bracket belongs to
        # whoever is holding it.
        if is_unclaimed(tournament):
            return True

        return _is_host(tournament, request.user)


class CanReportResults(permissions.BasePermission):
    """
    Reporting a result: the host, a co-host, or a linked participant.

    Letting participants report their own results is the point of linking an
    account (plan §3) — it stops the host being the single bottleneck for
    entering scores all night.
    """

    message = "You do not have permission to report results for this tournament."

    def has_object_permission(self, request, view, obj):
        tournament = obj if hasattr(obj, "roles") else getattr(obj, "tournament", None)
        if tournament is None:
            return False

        # An unclaimed quick-start bracket has no owner to protect, and whoever
        # is looking at it is the person who just built it. Requiring a login to
        # click a winner would make the no-account path useless: you could
        # create a bracket and then not run it (plan §4, NEW 6).
        if is_unclaimed(tournament):
            return True

        if not request.user.is_authenticated:
            return False

        if _is_host(tournament, request.user):
            return True

        if tournament.roles.filter(user=request.user, role="cohost").exists():
            return True

        # A participant whose account is linked and who has not left.
        return tournament.entrants.filter(
            participations__user=request.user, participations__status="active"
        ).exists()


def is_unclaimed(tournament) -> bool:
    """
    True for a quick-start bracket built while signed out, so it has no owner.

    Such a tournament has nothing to protect: the only people who know its id
    are whoever built it and whoever they gave the link to. A bracket created
    while signed in has `created_by` set, and the normal ownership rules apply.
    """
    return tournament.created_by_id is None


def _is_host(tournament, user) -> bool:
    """Host, explicit host role, or the owner of the group it belongs to."""
    if not user.is_authenticated:
        return False

    if tournament.created_by_id == user.id:
        return True

    if tournament.roles.filter(user=user, role="host").exists():
        return True

    return False
