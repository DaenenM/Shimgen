"""Group, roster and catalogue endpoints."""

from django.db import models
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsGroupMember, IsOwner

from .models import Game, GameMode, Group, Membership, Player, Season
from .serializers import (
    GameModeSerializer,
    GameSerializer,
    GroupDetailSerializer,
    GroupSerializer,
    PlayerBulkSerializer,
    PlayerSerializer,
    SeasonSerializer,
)


class GroupViewSet(viewsets.ModelViewSet):
    """Crews the signed-in user owns or belongs to."""

    serializer_class = GroupSerializer
    permission_classes = [IsGroupMember]
    lookup_field = "slug"

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Group.objects.none()

        return (
            Group.objects.filter(models.Q(owner=user) | models.Q(memberships__user=user))
            .distinct()
            .select_related("owner")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return GroupDetailSerializer
        return GroupSerializer

    def perform_create(self, serializer):
        group = serializer.save(owner=self.request.user)
        # The owner is also a member, so membership queries do not need to
        # special-case them everywhere.
        Membership.objects.create(group=group, user=self.request.user, role=Membership.Role.OWNER)

    @action(detail=True, methods=["get"])
    def players(self, request, slug=None):
        """The group's roster, most recently played first."""
        group = self.get_object()
        queryset = group.players.active().recently_used().select_related("user")

        return Response(PlayerSerializer(queryset, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def standings(self, request, slug=None):
        """
        Leaderboard across the group, scoped to a mode and optionally a season.

        Computed from Rating rows rather than stored, so it cannot drift from
        the match history it derives from.
        """
        from apps.tournaments.models import Rating

        group = self.get_object()
        mode_id = request.query_params.get("mode")

        ratings = (
            Rating.objects.filter(player__group=group)
            .select_related("player", "mode")
            .order_by("-elo")
        )
        if mode_id:
            ratings = ratings.filter(mode_id=mode_id)

        return Response(
            [
                {
                    "player_id": r.player_id,
                    "display_name": r.player.display_name,
                    "mode": r.mode_id,
                    "elo": round(r.elo, 1),
                    "games": r.games,
                    "wins": r.wins,
                    "losses": r.losses,
                    "win_rate": round(r.wins / r.games, 3) if r.games else 0.0,
                }
                for r in ratings
            ]
        )


class PlayerViewSet(viewsets.ModelViewSet):
    """
    The signed-in user's saved roster.

    This is the feature the plan calls the highest ratio of user-delight to
    engineering effort (plan §3): names typed once come back as clickable chips
    next Saturday, so nobody retypes ten names every week.
    """

    serializer_class = PlayerSerializer
    permission_classes = [IsOwner]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Player.objects.none()

        queryset = Player.objects.filter(owner=user).select_related("user", "group")

        # The archived filter is for the list only. Applied to every action it
        # also hid archived players from `get_object`, so restoring one 404'd —
        # archiving somebody was a one-way door.
        if self.action == "list" and self.request.query_params.get("include_archived") != "true":
            queryset = queryset.active()

        group = self.request.query_params.get("group")
        if group:
            queryset = queryset.filter(group_id=group)

        return queryset.recently_used()

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """Paste-a-list import (plan §4, NEW 8)."""
        serializer = PlayerBulkSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        created = serializer.save()

        return Response(
            PlayerSerializer(created, many=True, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"])
    def merge_local(self, request):
        """
        Merge a logged-out roster into the account on signup.

        The localStorage shape mirrors Player deliberately (plan §5), so this is
        a straight bulk insert with no translation — which is what makes the
        no-account path safe to offer in the first place.
        """
        serializer = PlayerBulkSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        created = serializer.save()

        return Response({"merged": len(created)}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """
        Hide someone who has drifted out of the group.

        Archiving rather than deleting: their results are part of everyone
        else's history, and deleting the roster entry would orphan them.
        """
        player = self.get_object()
        player.archived = True
        player.save(update_fields=["archived", "updated_at"])

        return Response(self.get_serializer(player).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        player = self.get_object()
        player.archived = False
        player.save(update_fields=["archived", "updated_at"])

        return Response(self.get_serializer(player).data)

    @action(detail=True, methods=["post"])
    def touch(self, request, pk=None):
        """Mark as played just now, so the roster picker orders by recency."""
        player = self.get_object()
        player.last_used_at = timezone.now()
        player.save(update_fields=["last_used_at", "updated_at"])

        return Response(self.get_serializer(player).data)


class GameViewSet(viewsets.ModelViewSet):
    """
    The game catalogue.

    A null group marks a global preset offered to everyone, so a new crew is not
    starting from an empty list.
    """

    serializer_class = GameSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Game.objects.prefetch_related("modes")

        if not user.is_authenticated:
            return queryset.filter(group__isnull=True)

        return queryset.filter(
            models.Q(group__isnull=True)
            | models.Q(group__owner=user)
            | models.Q(group__memberships__user=user)
        ).distinct()


class GameModeViewSet(viewsets.ModelViewSet):
    serializer_class = GameModeSerializer

    def get_queryset(self):
        queryset = GameMode.objects.select_related("game")
        game = self.request.query_params.get("game")
        return queryset.filter(game_id=game) if game else queryset


class SeasonViewSet(viewsets.ModelViewSet):
    """Seasons (plan §4, NEW 5)."""

    serializer_class = SeasonSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Season.objects.none()

        return Season.objects.filter(
            models.Q(group__owner=user) | models.Q(group__memberships__user=user)
        ).distinct()

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """
        End a season and start the next one.

        Ratings are not reset: the archive is the season's standings, and a
        player's Elo is a property of them, not of the window it was earned in.
        """
        season = self.get_object()
        season.is_active = False
        season.save(update_fields=["is_active", "updated_at"])

        return Response(self.get_serializer(season).data)
