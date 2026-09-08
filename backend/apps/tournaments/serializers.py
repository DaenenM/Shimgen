"""Serializers for tournaments, entrants and matches."""

from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.groups.models import Player
from apps.groups.serializers import PlayerSerializer

from .models import Entrant, FFAResult, Match, Participation, Role, Tournament


class EntrantSerializer(serializers.ModelSerializer):
    """
    A participant in one tournament.

    `label` is the per-event nickname — the [Pig Benis] half of the identity
    model — and `players` the optional roster link behind it.
    """

    players = PlayerSerializer(many=True, read_only=True)
    player_ids = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source="players",
    )

    class Meta:
        model = Entrant
        fields = (
            "id",
            "label",
            "seed",
            "players",
            "player_ids",
            "joined_round",
            "eliminated",
        )
        read_only_fields = ("id", "eliminated")


class FFAResultSerializer(serializers.ModelSerializer):
    entrant_label = serializers.CharField(source="entrant.label", read_only=True)

    class Meta:
        model = FFAResult
        fields = ("id", "entrant", "entrant_label", "placement", "points")


class MatchSerializer(serializers.ModelSerializer):
    """One node of the match graph."""

    a_label = serializers.CharField(source="a.label", read_only=True, default=None)
    b_label = serializers.CharField(source="b.label", read_only=True, default=None)
    wins_needed = serializers.IntegerField(read_only=True)
    is_ready = serializers.BooleanField(read_only=True)
    ffa_results = FFAResultSerializer(many=True, read_only=True)
    reported_by = PublicUserSerializer(read_only=True)

    class Meta:
        model = Match
        fields = (
            "id",
            "round_no",
            "position",
            "bracket",
            "a",
            "b",
            "a_label",
            "b_label",
            "winner",
            "best_of",
            "wins_needed",
            "is_ready",
            "score",
            "next_match_win",
            "next_match_lose",
            "ffa_results",
            "reported_at",
            "reported_by",
        )
        read_only_fields = (
            "id",
            "round_no",
            "position",
            "bracket",
            "a",
            "b",
            "winner",
            "score",
            "next_match_win",
            "next_match_lose",
            "reported_at",
            "reported_by",
        )


class ReportResultSerializer(serializers.Serializer):
    """A head-to-head result, as series wins."""

    score_a = serializers.IntegerField(min_value=0)
    score_b = serializers.IntegerField(min_value=0)


class ReportFFASerializer(serializers.Serializer):
    """A lobby's finishing order: entrant id -> placement."""

    placements = serializers.DictField(child=serializers.IntegerField(min_value=1))


class RoleSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = Role
        fields = ("id", "user", "role")


class ParticipationSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    entrant_label = serializers.CharField(source="entrant.label", read_only=True)

    class Meta:
        model = Participation
        fields = ("id", "entrant", "entrant_label", "user", "status")
        read_only_fields = ("id", "entrant", "user")


class TournamentSerializer(serializers.ModelSerializer):
    """List view: enough to render a card, no match graph."""

    entrant_count = serializers.SerializerMethodField()
    created_by = PublicUserSerializer(read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "title",
            "format",
            "state",
            "group",
            "mode",
            "season",
            "third_place_match",
            "settings",
            "public_slug",
            "entrant_count",
            "created_by",
            "favourited_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "state",
            "public_slug",
            "created_by",
            "favourited_at",
            "created_at",
        )

    def get_entrant_count(self, obj) -> int:
        return obj.entrants.count()


class TournamentDetailSerializer(TournamentSerializer):
    """
    The bracket page: everything needed to render it in one request.

    A bracket is useless without its matches, and fetching them separately
    guarantees a flash of empty bracket on every load.
    """

    entrants = EntrantSerializer(many=True, read_only=True)
    matches = MatchSerializer(many=True, read_only=True)
    roles = RoleSerializer(many=True, read_only=True)
    accepts_late_entrants = serializers.BooleanField(read_only=True)
    can_report = serializers.SerializerMethodField()
    is_host = serializers.SerializerMethodField()

    class Meta(TournamentSerializer.Meta):
        fields = (
            *TournamentSerializer.Meta.fields,
            "description",
            "rules",
            "entrants",
            "matches",
            "roles",
            "accepts_late_entrants",
            "can_report",
            "is_host",
            "started_at",
            "completed_at",
        )

    def get_can_report(self, obj) -> bool:
        """So the client knows whether to render result inputs at all."""
        from apps.common.permissions import CanReportResults

        request = self.context.get("request")
        if request is None:
            return False
        return CanReportResults().has_object_permission(request, None, obj)

    def get_is_host(self, obj) -> bool:
        from apps.tournaments.views import acts_as_host

        request = self.context.get("request")
        if request is None:
            return False
        return acts_as_host(obj, request.user)


class SpectatorSerializer(TournamentDetailSerializer):
    """
    The public, read-only view (plan §4, NEW 2).

    Same shape as the host's view minus anything that identifies people or
    hints at controls: no roles, no reporter identity, no roster links. Nine
    friends click this link without an account, and it should tell them who is
    playing whom and nothing about the accounts behind the names.
    """

    class Meta(TournamentDetailSerializer.Meta):
        fields = tuple(
            f
            for f in TournamentDetailSerializer.Meta.fields
            if f not in ("roles", "can_report", "is_host", "created_by", "settings")
        )


class CreateTournamentSerializer(serializers.ModelSerializer):
    """
    Creating an event, optionally with its entrants in one call.

    `entrant_labels` is what makes the no-account quick start work: paste ten
    names, get a bracket, no signup (plan §4, NEW 6).
    """

    entrant_labels = serializers.ListField(
        child=serializers.CharField(max_length=80),
        write_only=True,
        required=False,
        allow_empty=True,
        max_length=256,
    )
    # Team membership, for entrants that are squads rather than individuals.
    # Each item is {"label": "Blue Shells", "members": ["Alex", "Mark"]}.
    # Without this the team generator's output arrives as bare names and the
    # bracket cannot show who is on which side — which is exactly what people
    # need mid-tournament when they have forgotten their own team.
    entrant_teams = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=True,
        max_length=256,
    )
    seeding = serializers.ChoiceField(
        choices=["manual", "random", "rating"], default="random", write_only=True
    )

    class Meta:
        model = Tournament
        fields = (
            "id",
            "title",
            "description",
            "rules",
            "format",
            "group",
            "mode",
            "season",
            "third_place_match",
            "settings",
            "entrant_labels",
            "entrant_teams",
            "seeding",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        labels = attrs.get("entrant_labels") or []
        teams = attrs.get("entrant_teams") or []

        if teams:
            for team in teams:
                if not str(team.get("label", "")).strip():
                    raise serializers.ValidationError({"entrant_teams": "Every team needs a name."})
            if len(teams) < 2:
                raise serializers.ValidationError(
                    {"entrant_teams": "A tournament needs at least two entrants."}
                )
        elif labels and len(labels) < 2:
            raise serializers.ValidationError(
                {"entrant_labels": "A tournament needs at least two entrants."}
            )

        return attrs
