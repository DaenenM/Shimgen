"""Serializers for groups, rosters and the game catalogue."""

from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer

from .models import Game, GameMode, Player


class PlayerSerializer(serializers.ModelSerializer):
    """
    A roster entry — the clickable name chip when creating an event.

    `user` is the optional account link: the (Brett) half of the identity model.
    It is read-only here and set through the dedicated link action, because
    attaching someone's account to a roster entry has consent implications and
    should not be a silent field write.
    """

    user = PublicUserSerializer(read_only=True)
    linked = serializers.SerializerMethodField()
    is_friend = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = (
            "id",
            "display_name",
            "user",
            "linked",
            "is_friend",
            "is_self",
            "last_used_at",
            "archived",
            "created_at",
        )
        read_only_fields = ("id", "user", "last_used_at", "created_at")

    def get_linked(self, obj) -> bool:
        return obj.user_id is not None

    def get_is_self(self, obj) -> bool:
        """
        Whether this row is the roster's owner.

        No prefetch needed, unlike `is_friend`: the answer is already on the row.
        """
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False

        return obj.user_id == request.user.id

    def get_is_friend(self, obj) -> bool:
        """
        Whether this roster entry is someone the owner is actually friends with.

        Narrower than `linked`, and deliberately so: a co-host who claimed a
        bracket is linked to an account without being a friend. Only a friend's
        entry follows their name, so only a friend's entry should say it does.

        Reads a set the view prefetches once — computing it per row would be a
        query per name on a page whose whole point is showing all of them.
        """
        if obj.user_id is None:
            return False

        return obj.user_id in self.context.get("friend_ids", frozenset())

    def create(self, validated_data):
        # The roster always belongs to whoever is signed in; taking `owner` from
        # the payload would let one user write into another's roster.
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class PlayerBulkSerializer(serializers.Serializer):
    """
    Paste-a-list roster import (plan §4, NEW 8).

    Organisers already have their names somewhere; accepting a pasted block is
    an afternoon of work and removes the worst friction in setting up an event.
    """

    names = serializers.ListField(
        child=serializers.CharField(max_length=60), allow_empty=False, max_length=200
    )

    def create(self, validated_data):
        user = self.context["request"].user

        # De-duplicate against what is already there, case-insensitively, so
        # pasting the same list twice does not double the roster.
        existing = {
            name.lower()
            for name in Player.objects.filter(owner=user).values_list("display_name", flat=True)
        }

        created = []
        seen = set()

        for raw in validated_data["names"]:
            name = raw.strip()
            key = name.lower()
            if not name or key in existing or key in seen:
                continue
            seen.add(key)
            created.append(Player(owner=user, display_name=name))

        return Player.objects.bulk_create(created)


class GameModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameMode
        fields = ("id", "game", "name", "is_team_based")


class GameSerializer(serializers.ModelSerializer):
    modes = GameModeSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = ("id", "name", "slug", "modes")
        read_only_fields = ("id", "slug")
