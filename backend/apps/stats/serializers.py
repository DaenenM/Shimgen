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

    class Meta:
        model = StatsRow
        fields = ["id", "label", "display_name", "player", "position", "counts"]

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


class StatsBoardSerializer(serializers.ModelSerializer):
    """The list view — enough to render a card, without loading every tally."""

    role = serializers.SerializerMethodField()
    table_count = serializers.IntegerField(source="tables.count", read_only=True)
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
