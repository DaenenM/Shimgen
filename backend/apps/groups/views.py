"""Roster and catalogue endpoints."""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.permissions import IsOwner

from .models import Game, GameMode, Player
from .serializers import (
    GameModeSerializer,
    GameSerializer,
    PlayerBulkSerializer,
    PlayerSerializer,
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

    def get_serializer_context(self):
        """
        Resolve the owner's friends once, not once per roster entry.

        `is_friend` on each row would otherwise be a query per name, and the
        roster picker renders every name there is.
        """
        from apps.accounts.models import friend_ids_for

        return {**super().get_serializer_context(), "friend_ids": friend_ids_for(self.request.user)}

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Player.objects.none()

        queryset = Player.objects.filter(owner=user).select_related("user")

        # The archived filter is for the list only. Applied to every action it
        # also hid archived players from `get_object`, so restoring one 404'd —
        # archiving somebody was a one-way door.
        if self.action == "list" and self.request.query_params.get("include_archived") != "true":
            queryset = queryset.active()

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

    def perform_destroy(self, instance):
        """
        A roster entry backed by an account cannot be deleted, only archived.

        Deleting one takes their rating history with it — `Rating` is CASCADE —
        and for a friend or for yourself that history belongs to a real person
        who did not ask for it to go. Archiving hides the row and keeps every
        number attached to it, which is what somebody reaching for the control
        actually wants.

        Enforced here rather than only in the client, because a hidden button is
        not a rule: the endpoint is a plain DELETE and anything holding a token
        can call it.
        """
        if instance.user_id is not None:
            raise ValidationError(
                "This roster entry belongs to an account, so it cannot be deleted. "
                "Archive them instead — it hides them and keeps their history."
            )

        instance.delete()

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
            return queryset

        return queryset.filter().distinct()


class GameModeViewSet(viewsets.ModelViewSet):
    serializer_class = GameModeSerializer

    def get_queryset(self):
        queryset = GameMode.objects.select_related("game")
        game = self.request.query_params.get("game")
        return queryset.filter(game_id=game) if game else queryset
