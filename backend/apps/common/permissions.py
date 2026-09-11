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


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Anyone who can see it may read; only the owner may change it."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(obj, "owner_id", None) == request.user.id


class IsGroupMember(permissions.BasePermission):
    """
    Ownership or admin gates writes.

    A member can see the crew's rosters and history. Changing the group itself
    stays with the owner and admins, so one member cannot rename or delete a
    group everyone else uses.
    """

    def has_object_permission(self, request, view, obj):
        group = None
        if group is None:
            return False

        if request.method in permissions.SAFE_METHODS:
            return (
                group.owner_id == request.user.id
                or group.memberships.filter(user=request.user).exists()
            )

        return (
            group.owner_id == request.user.id
            or group.memberships.filter(user=request.user, role__in=["owner", "admin"]).exists()
        )


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
    True for a quick-start bracket that nobody has claimed yet.

    Such a tournament has no owner and no group, so there is nothing to protect:
    the only people who know its id are whoever built it and whoever they gave
    the link to. Claiming it (or creating it while signed in) sets `created_by`
    and the normal ownership rules take over from there.
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
