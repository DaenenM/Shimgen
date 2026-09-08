"""Serializers for groups, rosters and the game catalogue."""

from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer

from .models import Game, GameMode, Group, Membership, Player, Season


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

    class Meta:
        model = Player
        fields = (
            "id",
            "display_name",
            "group",
            "user",
            "linked",
            "last_used_at",
            "archived",
            "created_at",
        )
        read_only_fields = ("id", "user", "last_used_at", "created_at")

    def get_linked(self, obj) -> bool:
        return obj.user_id is not None

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
    group = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(), required=False, allow_null=True
    )

    def create(self, validated_data):
        user = self.context["request"].user
        group = validated_data.get("group")

        # De-duplicate against what is already there, case-insensitively, so
        # pasting the same list twice does not double the roster.
        existing = {
            name.lower()
            for name in Player.objects.filter(owner=user, group=group).values_list(
                "display_name", flat=True
            )
        }

        created = []
        seen = set()

        for raw in validated_data["names"]:
            name = raw.strip()
            key = name.lower()
            if not name or key in existing or key in seen:
                continue
            seen.add(key)
            created.append(Player(owner=user, group=group, display_name=name))

        return Player.objects.bulk_create(created)


class GameModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameMode
        fields = ("id", "game", "name", "is_team_based")


class GameSerializer(serializers.ModelSerializer):
    modes = GameModeSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = ("id", "name", "slug", "group", "modes")
        read_only_fields = ("id", "slug")


class MembershipSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "role", "created_at")


class SeasonSerializer(serializers.ModelSerializer):
    """A competitive window (plan §4, NEW 5)."""

    class Meta:
        model = Season
        fields = ("id", "group", "name", "starts_on", "ends_on", "is_active")
        read_only_fields = ("id",)


class GroupSerializer(serializers.ModelSerializer):
    """A crew. `slug` is generated on save, so it is never accepted from input."""

    owner = PublicUserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    player_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "owner",
            "member_count",
            "player_count",
            "created_at",
        )
        read_only_fields = ("id", "slug", "owner", "created_at")

    def get_member_count(self, obj) -> int:
        return obj.memberships.count()

    def get_player_count(self, obj) -> int:
        return obj.players.filter(archived=False).count()


class GroupDetailSerializer(GroupSerializer):
    """The group page: everything needed to render it in one request."""

    memberships = MembershipSerializer(many=True, read_only=True)
    games = GameSerializer(many=True, read_only=True)
    seasons = SeasonSerializer(many=True, read_only=True)

    class Meta(GroupSerializer.Meta):
        fields = (*GroupSerializer.Meta.fields, "memberships", "games", "seasons")
