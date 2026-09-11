"""
Stats board endpoints.

The board is read far more than it is written — it lives on a second monitor
during game night — so the detail view returns the whole tree in one response
and the write endpoints are small, targeted actions rather than nested updates.
"""

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import F, Value
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import are_friends, friend_ids_for
from apps.groups.models import Player

from .awarding import ensure_automatic_columns
from .models import (
    BoardAccess,
    StatsBoard,
    StatsColumn,
    StatsEntry,
    StatsRow,
    StatsTable,
)
from .permissions import BoardPermission
from .serializers import (
    BoardAccessSerializer,
    StatsBoardDetailSerializer,
    StatsBoardSerializer,
    StatsColumnSerializer,
    StatsRowSerializer,
    StatsTableSerializer,
)

User = get_user_model()


class StatsBoardViewSet(viewsets.ModelViewSet):
    """Boards the signed-in user owns or has been given access to."""

    permission_classes = [BoardPermission]
    lookup_field = "slug"

    def get_permissions(self):
        # Retrieving by slug is open: the board is shareable by link, and the
        # slug is what keeps it unlisted.
        if self.action == "retrieve":
            return [AllowAny()]
        if self.action in {"list", "create"}:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return StatsBoardDetailSerializer
        return StatsBoardSerializer

    def get_serializer_context(self):
        # The detail view renders every row, and each row reports whether it is
        # a friend. Resolved once per request rather than per row.
        return {**super().get_serializer_context(), "friend_ids": friend_ids_for(self.request.user)}

    def get_queryset(self):
        # The list row reports table, player and editor counts, so the tree is
        # prefetched rather than walked per board — otherwise ten boards is
        # thirty round trips. `rows__player__user` is what keeps `is_friend`
        # from costing a query per name.
        base = StatsBoard.objects.select_related("owner").prefetch_related(
            "access", "tables__columns", "tables__rows__player__user"
        )

        # A single-object action resolves any board, because reads are
        # link-shareable and writes are gated by the object permission. Listing
        # stays scoped to the caller — a directory of everyone's boards is not
        # something anyone asked for.
        if self.action in {"retrieve", "update", "partial_update", "destroy"} or self.detail:
            return base

        user = self.request.user
        if not user.is_authenticated:
            return StatsBoard.objects.none()

        # Three ways a board is yours to see: you own it, you were given access,
        # or you are counted on it. The last is what makes a friend added to
        # someone's board find it in their own list rather than needing the
        # share link — they are already on it.
        return base.filter(
            models.Q(owner=user)
            | models.Q(access__user=user)
            | models.Q(tables__rows__player__user=user)
        ).distinct()

    def perform_create(self, serializer):
        board = serializer.save(owner=self.request.user)

        # A board with no table cannot be tallied into, and every board needs at
        # least one. Creating it here means the form does not have to.
        tracks = bool(self.request.data.get("tracks_tournaments"))
        table = StatsTable.objects.create(
            board=board, name="Tournaments" if tracks else "Wins", position=0
        )

        if tracks:
            ensure_automatic_columns(table)
        else:
            StatsColumn.objects.create(table=table, name="Wins", position=0)

    def perform_destroy(self, instance):
        if instance.role_for(self.request.user) != "owner":
            raise ValidationError("Only the board's owner can delete it.")
        instance.delete()

    # ── Structure ────────────────────────────────────────────────────────────

    @extend_schema(request=dict, responses={201: StatsTableSerializer})
    @action(detail=True, methods=["post"], url_path="tables")
    def add_table(self, request, slug=None):
        """
        Add a section — "Teams" alongside "Solo".

        `tracks_tournaments` builds it with the four columns a linked bracket
        fills in by itself: games played, won, lost and tournaments won.
        Otherwise it gets a single hand-counted tally, which is the Pummel Party
        case — nobody generated a bracket for it.
        """
        board = self._editable()

        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "A table needs a name."})

        table = StatsTable.objects.create(board=board, name=name, position=board.tables.count())

        if request.data.get("tracks_tournaments"):
            ensure_automatic_columns(table)
        else:
            # A table with no column has nowhere to put a mark.
            StatsColumn.objects.create(
                table=table,
                name=request.data.get("column_name") or "Wins",
                emoji=request.data.get("emoji") or StatsColumn._meta.get_field("emoji").default,
            )

        return Response(
            StatsTableSerializer(table).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=dict, responses={200: StatsBoardDetailSerializer})
    @action(detail=True, methods=["post"], url_path="award")
    def award(self, request, slug=None):
        """
        Add or remove marks by hand — the no-tournament case.

        `delta` rather than an absolute count: two people tallying at once should
        add two marks, not race to set the same number.
        """
        board = self._editable()

        row = get_object_or_404(StatsRow, pk=request.data.get("row"), table__board=board)
        column = get_object_or_404(StatsColumn, pk=request.data.get("column"), table__board=board)

        if row.table_id != column.table_id:
            raise ValidationError("That row and column are on different tables.")

        try:
            delta = int(request.data.get("delta", 1))
        except (TypeError, ValueError):
            raise ValidationError({"delta": "Must be a whole number."}) from None

        with transaction.atomic():
            entry, _ = StatsEntry.objects.get_or_create(row=row, column=column)
            # One statement, so simultaneous taps both land — and the floor is
            # part of it rather than a follow-up update, because the count may
            # never be negative even momentarily: the check constraint would
            # reject the intermediate value before a second query could clamp
            # it. Undoing past zero settles at zero instead of failing.
            StatsEntry.objects.filter(pk=entry.pk).update(
                count=Greatest(F("count") + delta, Value(0))
            )
            entry.refresh_from_db()

        return Response({"row": row.id, "column": column.id, "count": entry.count})

    @extend_schema(request=dict, responses={200: StatsBoardSerializer})
    @action(detail=True, methods=["post"])
    def favourite(self, request, slug=None):
        """
        Pin this board to the top of the list, or unpin it.

        Stamped with the time rather than flagged, so pinning a second board
        puts it below the first instead of competing with it for the top.
        """
        board = self._editable()

        board.favourited_at = None if board.favourited_at else timezone.now()
        board.save(update_fields=["favourited_at", "updated_at"])

        return Response(StatsBoardSerializer(board, context={"request": request}).data)

    # ── Access ───────────────────────────────────────────────────────────────

    @extend_schema(request=dict, responses={201: BoardAccessSerializer})
    @action(detail=True, methods=["post"], url_path="people")
    def add_person(self, request, slug=None):
        """
        Let someone else tally and link tournaments.

        Owner only: an editor who could grant access could grant it to anyone,
        which would make the owner's control over the board nominal.
        """
        board = self.get_object()
        if board.role_for(request.user) != "owner":
            raise ValidationError("Only the board's owner can share it.")

        # Addressed by account id when picked from the friends list, or by email
        # when typed. Either way the person has to be a friend already.
        user_id = request.data.get("user")
        email = (request.data.get("email") or "").strip().lower()

        if user_id:
            person = User.objects.filter(pk=user_id).first()
        elif email:
            person = User.objects.filter(email__iexact=email).first()
        else:
            raise ValidationError({"user": "Choose a friend to add."})

        if person is None:
            # Named plainly rather than silently pending: the owner needs to
            # know the invite did not land so they can chase it up.
            raise ValidationError({"email": "Nobody with that email has an account yet."})

        if person.id == board.owner_id:
            raise ValidationError({"email": "They already own this board."})

        # Editing a board is a real grant — it writes into everyone's history —
        # so it is limited to people the owner has already linked accounts with.
        # Knowing an email address is not the same as being trusted.
        if not are_friends(request.user, person):
            raise ValidationError(
                {
                    "user": (
                        "You can only share a board with your friends. Add them as a friend first."
                    )
                }
            )

        access, created = BoardAccess.objects.get_or_create(
            board=board,
            user=person,
            defaults={"invited_by": request.user},
        )

        return Response(
            BoardAccessSerializer(access).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @extend_schema(responses={204: None})
    @action(detail=True, methods=["delete"], url_path="people/(?P<user_id>[^/.]+)")
    def remove_person(self, request, slug=None, user_id=None):
        board = self.get_object()
        if board.role_for(request.user) != "owner":
            raise ValidationError("Only the board's owner can change who has access.")

        BoardAccess.objects.filter(board=board, user_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _editable(self):
        """The board, having checked the caller may write to it."""
        board = self.get_object()
        if not board.may_edit(self.request.user):
            raise ValidationError("You do not have permission to change this board.")
        return board


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
