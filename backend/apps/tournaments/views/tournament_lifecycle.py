"""Restage, pin, archive, restore and delete.

Mixed into TournamentViewSet (views/tournament.py).
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..models import Role
from ..permissions import acts_as_host
from ..serializers import (
    TournamentDetailSerializer,
    TournamentSerializer,
)
from ..services.creation import generate_bracket
from ..services.restage import restage_tournament
from ..services.stats_link import strip_linked_stats


class LifecycleActionsMixin:
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
            generate_bracket(clone, "random" if request.data.get("reshuffle") else "manual")

        clone = self.get_queryset().get(pk=clone.pk)
        return Response(
            TournamentDetailSerializer(clone, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

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

    def perform_destroy(self, instance):
        """
        Delete the tournament and everything it put on a linked board.

        The link itself cascades away, but the numbers it wrote do not — so
        without this a deleted tournament leaves permanent wins on a board with
        nothing behind them. The client warns about this before confirming.
        """
        strip_linked_stats(instance)
        instance.delete()
