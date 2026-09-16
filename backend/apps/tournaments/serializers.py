"""Serializers for tournaments, entrants and matches."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.groups.models import Player
from apps.groups.serializers import PlayerSerializer

from .models import (
    DraftTeam,
    Entrant,
    Match,
    Participation,
    Role,
    TeamDraft,
    Tournament,
)
from .standings import champion_entrant_id


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


class MatchSerializer(serializers.ModelSerializer):
    """One node of the match graph."""

    a_label = serializers.CharField(source="a.label", read_only=True, default=None)
    b_label = serializers.CharField(source="b.label", read_only=True, default=None)
    wins_needed = serializers.IntegerField(read_only=True)
    is_ready = serializers.BooleanField(read_only=True)
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


class BatchOperationSerializer(serializers.Serializer):
    """One entry in a batch: report a score, or clear a match."""

    match = serializers.IntegerField()
    op = serializers.ChoiceField(choices=["report", "clear"], default="report")
    score_a = serializers.IntegerField(min_value=0, required=False)
    score_b = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        if attrs.get("op", "report") == "report":
            missing = [f for f in ("score_a", "score_b") if attrs.get(f) is None]
            if missing:
                raise serializers.ValidationError(
                    dict.fromkeys(missing, "Required when op is 'report'.")
                )
        return attrs


class BatchReportSerializer(serializers.Serializer):
    """
    A run of results reported together.

    The client collects clicks and sends them in one request rather than one
    per click. Order matters and is preserved: a later entry may correct an
    earlier one, and advancement depends on what came before it.
    """

    # Capped so a malformed or hostile client cannot hand us unbounded work in
    # a single transaction. A host clicking through a night never approaches it.
    operations = serializers.ListField(
        child=BatchOperationSerializer(), allow_empty=False, max_length=200
    )


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
    # Who won, for a finished tournament. Named on the card so a list of past
    # nights reads as a record rather than a set of identical rows.
    winner_label = serializers.SerializerMethodField()
    # Whether deleting this would also take numbers off a board. The client
    # warns about that, and a warning shown when nothing is linked would train
    # hosts to dismiss it.
    feeds_stats_board = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = (
            "id",
            "title",
            "format",
            "state",
            "mode",
            "third_place_match",
            "settings",
            "public_slug",
            "entrant_count",
            "created_by",
            "winner_label",
            "favourited_at",
            "archived",
            "feeds_stats_board",
            "created_at",
        )
        read_only_fields = (
            "id",
            "state",
            "public_slug",
            "created_by",
            "winner_label",
            "favourited_at",
            "archived",
            "created_at",
        )

    def get_entrant_count(self, obj) -> int:
        return obj.entrants.count()

    def get_feeds_stats_board(self, obj) -> bool:
        return getattr(obj, "stats_link", None) is not None

    def get_winner_label(self, obj) -> str | None:
        """
        The champion's name, once the tournament is over.

        Only computed for a complete tournament: an unfinished bracket has a
        leader, not a winner, and naming one on the card would be wrong for as
        long as the night is still being played.
        """
        if obj.state != Tournament.State.COMPLETE:
            return None

        entrant_id = champion_entrant_id(obj)
        if entrant_id is None:
            return None

        entrant = next((e for e in obj.entrants.all() if e.id == entrant_id), None)
        return entrant.label if entrant else None


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
    # Which board this feeds, by name. The list view's `feeds_stats_board` says
    # only whether one exists, which is enough to warn before a delete but not
    # enough for the bracket page to show the host what it is pointed at.
    stats_board = serializers.SerializerMethodField()
    # Null for every tournament that was not drafted, which is most of them.
    # Present so the bracket page can redirect to the lobby in the one request
    # it already makes, rather than discovering mid-render that this tournament
    # has no entrants yet because its draft is still running.
    team_draft = serializers.SerializerMethodField()

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
            "stats_board",
            "team_draft",
            "started_at",
            "completed_at",
        )

    # The schema is spelled out rather than referencing TeamDraftSerializer,
    # which is defined below this class: a decorator argument is evaluated at
    # class-definition time, so naming it here would be a NameError on import.
    @extend_schema_field({"type": "object", "nullable": True})
    def get_team_draft(self, obj):
        draft = getattr(obj, "team_draft", None)
        if draft is None:
            return None
        return TeamDraftSerializer(draft, context=self.context).data

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

    @extend_schema_field(
        {
            "type": "object",
            "nullable": True,
            "properties": {
                "slug": {"type": "string"},
                "name": {"type": "string"},
                "table_id": {"type": "integer"},
                "table_name": {"type": "string"},
            },
        }
    )
    def get_stats_board(self, obj):
        """
        The linked board, and which of its tables this feeds.

        The table is named as well as the board because a board may have several
        — "Solo wins" and "Team wins" — and the picker has to be able to show
        which one is ticked. Saying only the board would leave both tables
        looking equally selected.
        """
        link = getattr(obj, "stats_link", None)
        if link is None:
            return None

        table = link.stats_table
        if table is None:
            return None

        return {
            "slug": table.board.slug,
            "name": table.board.name,
            "table_id": table.id,
            "table_name": table.name,
        }


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
            "mode",
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


class DraftTeamSerializer(serializers.ModelSerializer):
    """One side mid-draft: its captain, and whoever has been picked so far."""

    members = serializers.SerializerMethodField()
    is_picking = serializers.SerializerMethodField()

    class Meta:
        model = DraftTeam
        fields = ("id", "position", "label", "captain_label", "members", "is_picking")
        read_only_fields = fields

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_members(self, obj):
        """
        The captain first, then their picks in the order they were taken.

        The captain leads because they are on the team and that is how the room
        says it out loud — "Ada's team: Ada, Grace, Alan". It also matches the
        shape entrant creation receives when the draft completes, so what the
        page shows mid-draft is what the bracket will show afterwards.
        """
        return [obj.captain_label, *[pick.label for pick in obj.picks.all()]]

    def get_is_picking(self, obj) -> bool:
        return obj.draft.current_team_index == obj.position


class TeamDraftSerializer(serializers.ModelSerializer):
    """
    A draft in progress: whose turn it is, who is left, and how it will end.

    `pool` and `picks_per_team` are computed rather than stored. The pool is
    "everyone not yet picked", which is a query the picks already answer —
    keeping a second copy in sync by hand is exactly the drift the standings
    rule warns about.
    """

    teams = DraftTeamSerializer(many=True, read_only=True)
    pool = serializers.SerializerMethodField()
    current_team = serializers.SerializerMethodField()
    picks_remaining = serializers.SerializerMethodField()
    expected_sizes = serializers.SerializerMethodField()

    class Meta:
        model = TeamDraft
        fields = (
            "id",
            "team_count",
            "captain_mode",
            "teams",
            "pool",
            # The whole rotation, not just whose turn it is now. The client
            # applies a pick to its own cache the instant it is tapped — a draft
            # is a room of people watching one screen, and a name that hangs for
            # a round trip before moving reads as a missed tap — which means it
            # has to work out the *next* turn locally. `current_team` alone can
            # only say where the draft is, never where it goes next.
            "pick_order",
            "current_team",
            "picks_made",
            "picks_remaining",
            "expected_sizes",
            "completed_at",
        )
        read_only_fields = fields

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_pool(self, obj):
        """Whoever has not been picked yet, in the order they were entered."""
        taken = {pick.label.lower() for pick in obj.picks.all()}
        return [
            name
            for name in (obj.tournament.settings or {}).get("draft_pool", [])
            if name.lower() not in taken
        ]

    def get_current_team(self, obj) -> int | None:
        return obj.current_team_index

    def get_picks_remaining(self, obj) -> int:
        return max(0, len(obj.pick_order) - obj.picks_made)

    @extend_schema_field({"type": "array", "items": {"type": "integer"}})
    def get_expected_sizes(self, obj):
        """
        How many players each team ends up with, captain included.

        Surfaced so the page can say up front that an uneven pool leaves one
        team a player short, rather than letting a host discover it on the
        final pick.
        """
        from .drafting import picks_per_team

        pool_size = len(obj.pick_order)
        return [count + 1 for count in picks_per_team(obj.team_count, pool_size)]
