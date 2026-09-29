"""Linking a tournament to a stats board, and keeping the board in step."""

from rest_framework.exceptions import ValidationError


def link_stats(tournament, board_slug, table_id, column_id, user):
    """
    Point this tournament at a stats board.

    Naming the board is enough: the columns a tournament fills are fixed, so the
    board itself knows where its results go. `stats_table` and `stats_column`
    remain for callers that want to name a specific one — an older client, or a
    board with several tables — but the host picking "League" from a list does
    not have to answer a second question about it.

    Gated on edit rights: linking writes onto someone else's board, so it needs
    the same permission tallying by hand does. A target the caller may not write
    to is refused outright rather than silently dropped — a host who thinks the
    night is being counted and finds out later that it was not is worse off than
    one told now.

    Players are enrolled immediately rather than at the final whistle. The board
    should show tonight's line-up while the night is still going, and a name that
    only appears on victory makes the table useless as a team sheet.
    """
    if not board_slug and not table_id and not column_id:
        return

    from apps.stats.models import BoardLink, StatsBoard, StatsColumn, StatsTable
    from apps.stats.services.awarding import (
        enrol_tournament_players,
        ensure_automatic_columns,
        sync_tournament_stats,
    )

    if board_slug:
        board = StatsBoard.objects.filter(slug=board_slug).select_related("owner").first()
        if board is None:
            raise ValidationError({"stats_board": "No such stats board."})

        table = tournament_table_for(board)
        target = {"table": table}
    elif table_id:
        table = StatsTable.objects.filter(pk=table_id).select_related("board__owner").first()
        if table is None:
            raise ValidationError({"stats_table": "No such stats table."})
        target, board = {"table": table}, table.board
    else:
        column = (
            StatsColumn.objects.filter(pk=column_id).select_related("table__board__owner").first()
        )
        if column is None:
            raise ValidationError({"stats_column": "No such stats column."})
        target, board = {"column": column}, column.table.board

    if not board.may_edit(user):
        raise ValidationError(
            {"stats_board": "You do not have permission to add to that stats board."}
        )

    # A board picked by name may have been made for hand-counting. Rather than
    # refuse the link, give its table the columns a tournament needs — the host
    # asked for this night to count, and that is the thing that makes it count.
    if board_slug:
        ensure_automatic_columns(target["table"])

    # Re-linking is a move, not a second link: `BoardLink.tournament` is
    # one-to-one. The old board keeps whatever other tournaments gave it, but
    # this tournament's contribution comes off it first — otherwise switching
    # boards would leave tonight's wins sitting on a board it no longer feeds.
    unlink_stats(tournament)

    link = BoardLink.objects.create(tournament=tournament, **target)

    enrol_tournament_players(link)
    sync_tournament_stats(link)


def tournament_table_for(board):
    """
    The table on `board` that a tournament should feed.

    Prefers one already tracking tournaments; otherwise the first table, which
    is the only one on the overwhelming majority of boards. A board with no
    table at all gets one, since every board is created with one and this is
    only reachable if somebody deleted it.
    """
    from apps.stats.models import StatsColumn, StatsTable

    tables = list(board.tables.prefetch_related("columns"))

    for table in tables:
        if any(column.role != StatsColumn.Role.MANUAL for column in table.columns.all()):
            return table

    if tables:
        return tables[0]

    return StatsTable.objects.create(board=board, name="Tournaments", position=0)


def award_linked_stats(tournament):
    """
    Credit the winners on a linked stats board, if there is one.

    Imported here rather than at module scope: tournaments know nothing about
    boards, and keeping it that way means the stats app can be removed without
    touching the bracket engine. Awarding is idempotent, so a corrected result
    that re-completes the tournament does not hand out a second set of marks.
    """
    from apps.stats.services.awarding import apply_tournament_result

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        apply_tournament_result(link)


def unlink_stats(tournament):
    """
    Detach this tournament from whatever board it feeds.

    Takes its numbers off that board on the way out, exactly as deleting the
    tournament does — the contribution and the link are one thing, and leaving
    one without the other is what makes a board stop being trustworthy.

    Returns True when there was something to detach, so a caller can tell
    "unlinked" from "was never linked".
    """
    from apps.stats.services.awarding import strip_tournament_from_board

    link = getattr(tournament, "stats_link", None)
    if link is None:
        return False

    strip_tournament_from_board(link)
    link.delete()

    # The cached relation still points at the deleted row, and `link_stats`
    # checks it immediately afterwards when this is a switch rather than a
    # removal.
    try:
        del tournament.stats_link
    except AttributeError:
        pass

    return True


def strip_linked_stats(tournament):
    """
    Undo this tournament's contribution to a linked board.

    Imported here rather than at module scope, like the other two: tournaments
    know nothing about boards, and keeping it that way means the stats app can
    be removed without touching the bracket engine.
    """
    from apps.stats.services.awarding import strip_tournament_from_board

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        strip_tournament_from_board(link)


def sync_linked_stats(tournament):
    """
    Update a linked board's per-game numbers.

    Called after a result is reported *and* after one is cleared, because the
    counts are recomputed from the match rows rather than incremented — undoing
    a win has to walk the board back down as readily as reporting one walked it
    up.
    """
    from apps.stats.services.awarding import sync_tournament_stats

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        sync_tournament_stats(link)
