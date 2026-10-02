"""Linking a running tournament to a stats board.

Mixed into TournamentViewSet (views/tournament.py).
"""

from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..permissions import acts_as_host
from ..serializers import (
    TournamentDetailSerializer,
)
from ..services.stats_link import link_stats, unlink_stats


class StatsBoardActionsMixin:
    @action(detail=True, methods=["post"], url_path="stats-board")
    def link_stats_board(self, request, pk=None):
        """
        Point this tournament at a stats board, or move it to another one.

        The board is chosen when a tournament is created, but that is exactly
        the moment a host is least likely to have thought about it — the bracket
        is the thing they came for. Without this the choice was final: a night
        that should have counted towards the league simply did not, and the only
        fix was to run it again.

        Posting an empty `stats_board` unlinks. Linking a board that is already
        linked is a no-op rather than an error, so a double-tap on a phone
        cannot strip the board and put it back.

        `stats_table` names one table on a board directly, which is what a board
        with a Solo and a Teams table needs — picking the board alone lets the
        server choose, and it cannot know which of the two tonight belongs to.

        Numbers are brought up to date immediately: `link_stats` enrols the
        players and syncs whatever has been played so far, so a board linked
        halfway through a night shows that night's results rather than only the
        ones reported after the link.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can change the stats board.")

        slug = request.data.get("stats_board") or ""
        table_id = request.data.get("stats_table") or None

        current = getattr(tournament, "stats_link", None)
        current_slug = None
        current_table_id = None
        if current is not None and current.stats_table is not None:
            current_slug = current.stats_table.board.slug
            current_table_id = current.stats_table.id

        if table_id:
            # Compared as strings: the id arrives from JSON as either, and a
            # mismatch here would relink on every request — stripping the
            # night's numbers off and putting them straight back.
            if str(table_id) != str(current_table_id):
                link_stats(tournament, None, table_id, None, request.user)
        elif slug:
            if slug != current_slug:
                link_stats(tournament, slug, None, None, request.user)
        else:
            unlink_stats(tournament)

        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)
