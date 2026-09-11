"""Serializers for stats boards."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    BoardAccess,
    BoardLink,
    StatsBoard,
    StatsColumn,
    StatsEntry,
    StatsRow,
    StatsTable,
)

User = get_user_model()


class StatsColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatsColumn
        fields = ["id", "name", "emoji", "role", "display", "position"]
        # Set when the column is made and fixed after: what a column counts is
        # structural, and changing it would silently rewrite what its existing
        # numbers meant.
        read_only_fields = ["role"]


class StatsRowSerializer(serializers.ModelSerializer):
    """
    A row, with its tallies flattened to {column_id: count}.

    Flattened because the board renders a grid: the client asks "how many marks
    does this row have in that column", and a list of entry objects would make
    every cell a search.
    """

    display_name = serializers.CharField(read_only=True)
    counts = serializers.SerializerMethodField()
    player_user_id = serializers.SerializerMethodField()
    is_friend = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    class Meta:
        model = StatsRow
        fields = [
            "id",
            "label",
            "display_name",
            "player",
            "player_user_id",
            "is_friend",
            "is_self",
            "position",
            "counts",
        ]

    def validate_player(self, value):
        """
        Only your own roster entries may be attached to a row.

        `player` is writable so a row typed as a plain name can be swapped to a
        real account once that person registers. Without this check it is also a
        way to staple a stranger's roster entry — and therefore their account —
        onto any board you can edit, which would attach their name and their
        future tournament results to somebody else's record.

        `add_rows` already scopes its lookup this way; this is the same rule for
        the edit path.
        """
        if value is None:
            return value

        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError("Sign in to link a player.")

        if value.owner_id != request.user.id:
            raise serializers.ValidationError("That player is not on your roster.")

        return value

    def get_player_user_id(self, row) -> int | None:
        """
        The account behind this row, if it has one.

        The swap list uses it to leave out anyone already on the table. Matching
        on the name instead would miss exactly the case the swap exists for —
        a hand-typed "Brett" and the real Brett are the same person under two
        different strings.
        """
        return row.player.user_id if row.player_id else None

    def get_is_friend(self, row) -> bool:
        """Whether this row is somebody the reader is friends with."""
        if row.player_id is None or row.player.user_id is None:
            return False

        return row.player.user_id in self.context.get("friend_ids", frozenset())

    def get_is_self(self, row) -> bool:
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False
        if row.player_id is None:
            return False

        return row.player.user_id == request.user.id

    def get_counts(self, row) -> dict:
        return {str(entry.column_id): entry.count for entry in row.entries.all()}


class StatsTableSerializer(serializers.ModelSerializer):
    columns = StatsColumnSerializer(many=True, read_only=True)
    rows = StatsRowSerializer(many=True, read_only=True)
    tracks_tournaments = serializers.SerializerMethodField()

    class Meta:
        model = StatsTable
        fields = ["id", "name", "position", "columns", "rows", "tracks_tournaments"]

    def get_tracks_tournaments(self, table) -> bool:
        """Whether a tournament can be pointed at this table as a whole."""
        return any(column.role != StatsColumn.Role.MANUAL for column in table.columns.all())


class BoardAccessSerializer(serializers.ModelSerializer):
    # No email. An editor's address is not the board owner's to hand around, and
    # the name is what identifies them on a list of people anyway.
    display_name = serializers.CharField(source="user.name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = BoardAccess
        fields = ["id", "user", "display_name", "username", "role", "created_at"]
        read_only_fields = ["user", "created_at"]


class BoardTableSummarySerializer(serializers.ModelSerializer):
    """
    A table, named without its rows.

    The board list carries these so a tournament can be pointed at one table
    rather than at the board. A board with "Solo wins" and "Team wins" cannot
    have that decided for it — the server would be guessing which of the two
    tonight belongs to — and loading every row and tally just to fill a dropdown
    would make the list several times heavier for a few names.
    """

    tracks_tournaments = serializers.SerializerMethodField()

    class Meta:
        model = StatsTable
        fields = ["id", "name", "position", "tracks_tournaments"]

    def get_tracks_tournaments(self, table) -> bool:
        return any(column.role != StatsColumn.Role.MANUAL for column in table.columns.all())


class StatsBoardSerializer(serializers.ModelSerializer):
    """The list view — enough to render a card, without loading every tally."""

    role = serializers.SerializerMethodField()
    table_count = serializers.IntegerField(source="tables.count", read_only=True)
    # Named, not just counted, so the tournament picker can offer
    # "Pummel Party — Solo wins" as its own option.
    tables_summary = BoardTableSummarySerializer(source="tables", many=True, read_only=True)
    # A row in a list has room to say more than a card in a grid did: how many
    # people are on the board, and whether brackets keep it up to date.
    player_count = serializers.SerializerMethodField()
    tracks_tournaments = serializers.SerializerMethodField()
    editor_count = serializers.IntegerField(source="access.count", read_only=True)

    class Meta:
        model = StatsBoard
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "role",
            "table_count",
            "tables_summary",
            "player_count",
            "editor_count",
            "tracks_tournaments",
            "favourited_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "favourited_at", "created_at", "updated_at"]

    def get_role(self, board) -> str | None:
        request = self.context.get("request")
        return board.role_for(request.user) if request else None

    def get_player_count(self, board) -> int:
        """Distinct people across every table, not rows — someone on the Solo
        and Teams tables is one person, and counting them twice would make the
        board look busier than it is."""
        names = set()

        for table in board.tables.all():
            for row in table.rows.all():
                names.add(row.player_id or row.display_name.casefold())

        return len(names)

    def get_tracks_tournaments(self, board) -> bool:
        return any(
            column.role != StatsColumn.Role.MANUAL
            for table in board.tables.all()
            for column in table.columns.all()
        )


class StatsBoardDetailSerializer(StatsBoardSerializer):
    """The board itself — every table, column, row and count in one response."""

    tables = StatsTableSerializer(many=True, read_only=True)
    people = BoardAccessSerializer(source="access", many=True, read_only=True)

    class Meta(StatsBoardSerializer.Meta):
        fields = [*StatsBoardSerializer.Meta.fields, "tables", "people"]


class BoardLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardLink
        fields = ["id", "tournament", "table", "column", "awarded", "awarded_at"]
        read_only_fields = ["awarded", "awarded_at"]


class StatsEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatsEntry
        fields = ["id", "row", "column", "count"]
