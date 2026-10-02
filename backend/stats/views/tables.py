"""Tables, columns and rows inside a stats board."""

from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import friend_ids_for
from groups.models import Player

from ..models import (
    StatsColumn,
    StatsRow,
    StatsTable,
)
from ..permissions import BoardPermission
from ..serializers import (
    StatsColumnSerializer,
    StatsRowSerializer,
    StatsTableSerializer,
)
from ..services.awarding import ensure_automatic_columns


class StatsTableViewSet(viewsets.ModelViewSet):
    """Tables, columns and rows — the board's structure."""

    serializer_class = StatsTableSerializer
    permission_classes = [BoardPermission]

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "friend_ids": friend_ids_for(self.request.user)}

    def get_queryset(self):
        return StatsTable.objects.select_related("board").prefetch_related(
            "columns", "rows__entries", "rows__player__user"
        )

    @extend_schema(request=dict, responses={201: StatsColumnSerializer})
    @action(detail=True, methods=["post"], url_path="columns")
    def add_column(self, request, pk=None):
        """A new countable thing, with the emoji that marks it."""
        table = self._editable()

        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "A column needs a name."})

        if table.columns.filter(name__iexact=name).exists():
            raise ValidationError({"name": f'"{name}" is already a column on this table.'})

        column = StatsColumn.objects.create(
            table=table,
            name=name,
            emoji=(request.data.get("emoji") or "").strip()
            or StatsColumn._meta.get_field("emoji").default,
            position=table.columns.count(),
        )

        return Response(StatsColumnSerializer(column).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=dict, responses={200: StatsTableSerializer})
    @action(detail=True, methods=["post"], url_path="track-tournaments")
    def track_tournaments(self, request, pk=None):
        """
        Add the automatic tournament columns to a table that lacks them.

        Additive on purpose: a table that has been tallied by hand for months
        keeps every mark, and simply gains the columns a linked bracket can fill.
        """
        table = self._editable()
        ensure_automatic_columns(table)

        # Re-read: the instance was fetched with its columns prefetched, so the
        # ones just created would not appear in the response.
        table = self.get_queryset().get(pk=table.pk)

        return Response(StatsTableSerializer(table).data)

    @extend_schema(request=dict, responses={201: StatsRowSerializer})
    @action(detail=True, methods=["post"], url_path="rows")
    def add_rows(self, request, pk=None):
        """
        Add competitors, from the roster or as plain names.

        Takes a list, because names arrive pasted. A name already on the table is
        skipped rather than rejected, so re-pasting a list adds only whoever is
        new.
        """
        table = self._editable()

        names = request.data.get("names") or []
        player_ids = request.data.get("player_ids") or []

        if isinstance(names, str):
            names = [names]

        existing = {row.display_name.casefold() for row in table.rows.all()}
        position = table.rows.count()
        created = []

        # Roster players first, so a row that can be linked is linked — that
        # link is what lets a finished tournament find this row later.
        if player_ids and request.user.is_authenticated:
            for player in Player.objects.filter(owner=request.user, id__in=player_ids):
                if player.display_name.casefold() in existing:
                    continue
                created.append(
                    StatsRow(
                        table=table,
                        player=player,
                        label=player.display_name,
                        position=position + len(created),
                    )
                )
                existing.add(player.display_name.casefold())

        for raw in names:
            name = str(raw).strip()
            if not name or name.casefold() in existing:
                continue
            created.append(StatsRow(table=table, label=name, position=position + len(created)))
            existing.add(name.casefold())

        StatsRow.objects.bulk_create(created)

        return Response(
            StatsRowSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    def _editable(self):
        table = self.get_object()
        if not table.board.may_edit(self.request.user):
            raise ValidationError("You do not have permission to change this board.")
        return table


class StatsColumnViewSet(viewsets.ModelViewSet):
    """Rename a column or change its emoji."""

    serializer_class = StatsColumnSerializer
    permission_classes = [BoardPermission]

    def get_queryset(self):
        return StatsColumn.objects.select_related("table__board")


class StatsRowViewSet(viewsets.ModelViewSet):
    """Rename a competitor, swap them for a real account, or remove them."""

    serializer_class = StatsRowSerializer
    permission_classes = [BoardPermission]

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "friend_ids": friend_ids_for(self.request.user)}

    def get_queryset(self):
        return StatsRow.objects.select_related("table__board", "player__user").prefetch_related(
            "entries"
        )
