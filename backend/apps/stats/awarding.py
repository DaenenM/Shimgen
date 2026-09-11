"""
Turning tournaments into rows and numbers on a board.

The rule that governs everything here: results are credited to **people, not
entrants**. A 3v3 league won by "Team Benis" is three individual wins, because
the team name is a Saturday-night arrangement while the players persist. That is
what the board's optional `Player` link on each row is for — it is the join
between a bracket and a tally.

Two different things happen at two different times:

* **Per-game counts** (played / won / lost) are *recomputed* from the match rows
  whenever a result changes. Recomputing rather than incrementing is what makes
  correcting a bracket correct the board: an increment would leave the earlier,
  wrong result baked in, and there is no way to unpick it later.
* **Tournaments won** is credited once, when the bracket finishes, guarded by
  `link.awarded` so a correction that re-completes it cannot hand out a second
  trophy.
"""

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.tournaments.standings import champion_entrant_id

from .models import StatsColumn, StatsEntry, StatsRow

__all__ = [
    "AUTOMATIC_COLUMNS",
    "apply_tournament_result",
    "enrol_tournament_players",
    "ensure_automatic_columns",
    "strip_tournament_from_board",
    "sync_tournament_stats",
    "winning_players",
]


# The columns a tournament-tracking table gets, in the order they read.
# Games are numbers: forty of anything is a wall of glyphs. A tournament win is
# rare enough to stay a trophy you can count at a glance.
AUTOMATIC_COLUMNS = [
    {
        "role": StatsColumn.Role.PLAYED,
        "name": "Games played",
        "emoji": "\N{VIDEO GAME}",
        "display": StatsColumn.Display.NUMBER,
    },
    {
        "role": StatsColumn.Role.WON,
        "name": "Wins",
        "emoji": "\N{CHEQUERED FLAG}",
        "display": StatsColumn.Display.NUMBER,
    },
    {
        "role": StatsColumn.Role.LOST,
        "name": "Losses",
        "emoji": "\N{CROSS MARK}",
        "display": StatsColumn.Display.NUMBER,
    },
    {
        "role": StatsColumn.Role.TOURNAMENTS_WON,
        # "Trophies" rather than "Tournaments won": a header two words shorter
        # keeps the table narrow, and the trophy says what it counts anyway.
        "name": "Trophies",
        "emoji": "\N{TROPHY}",
        # A number, like the other tournament columns. Repeating the trophy in
        # every cell restated what the header already says and left the row
        # ragged against the three tidy numbers beside it.
        "display": StatsColumn.Display.NUMBER,
    },
]


def ensure_automatic_columns(table):
    """
    Give `table` the four tournament columns, keeping any it already has.

    Matched on role rather than name, so a crew that renamed "Games won" to
    "Wins" does not get a duplicate column the next time this runs.
    """
    existing = {column.role for column in table.columns.all()}
    taken = {column.name.casefold() for column in table.columns.all()}
    position = table.columns.count()
    created = []

    for spec in AUTOMATIC_COLUMNS:
        if spec["role"] in existing:
            continue

        # Names are unique per table, and a hand-counted table converting to a
        # tracking one very often already has a column called "Wins". Qualify
        # the automatic one rather than failing the conversion — the crew keeps
        # their existing tally and gains the bracket-fed one beside it.
        name = spec["name"]
        if name.casefold() in taken:
            name = f"{name} (tournaments)"

        taken.add(name.casefold())

        created.append(
            StatsColumn.objects.create(
                table=table,
                name=name,
                emoji=spec["emoji"],
                role=spec["role"],
                display=spec["display"],
                position=position + len(created),
            )
        )

    return created


def _columns_by_role(table) -> dict:
    return {column.role: column for column in table.columns.all()}


def tournament_players(tournament):
    """Every `Player` taking part, across all entrants."""
    players = {}

    for entrant in tournament.entrants.prefetch_related("players"):
        for player in entrant.players.all():
            players[player.id] = player

    return list(players.values())


def enrol_tournament_players(link) -> int:
    """
    Put everyone in the tournament on the board. Returns how many were added.

    Runs when the tournament is created, not when it finishes — the board should
    show who is playing tonight while the night is still going, and a name that
    appears only on victory makes the table useless as a team sheet.
    """
    table = link.stats_table
    if table is None:
        return 0

    return _rows_for(table, tournament_players(link.tournament))


def _rows_for(table, players) -> int:
    """Ensure a row exists for each player. Returns how many were created."""
    if not players:
        return 0

    linked = {row.player_id for row in table.rows.all() if row.player_id}
    # A name typed onto the board by hand before its player ever joined a
    # tournament should be adopted rather than duplicated.
    by_name = {
        row.display_name.casefold(): row for row in table.rows.all() if row.player_id is None
    }

    position = table.rows.count()
    created = 0

    for player in players:
        if player.id in linked:
            continue

        claimed = by_name.pop(player.display_name.casefold(), None)
        if claimed is not None:
            claimed.player = player
            claimed.save(update_fields=["player", "updated_at"])
            linked.add(player.id)
            continue

        StatsRow.objects.create(
            table=table,
            player=player,
            label=player.display_name,
            position=position + created,
        )
        linked.add(player.id)
        created += 1

    return created


def _game_counts(tournament) -> dict:
    """
    Games played / won / lost per player id.

    Counted in **games, not matches**: a Bo3 won 2-1 is three games played, two
    won and one lost. `Match.score` already holds exactly that — {"a": 2, "b":
    1} — so a series reports the record it actually was rather than collapsing
    to a single win.

    A walkover is excluded deliberately: nobody played it, and counting it would
    inflate the record of whoever drew the lucky bye. In-progress series do
    count, so the board tracks the night as it happens rather than jumping when
    each match resolves.
    """
    counts = {}

    played = (
        tournament.matches.exclude(a__isnull=True)
        .exclude(b__isnull=True)
        .select_related("a", "b")
        .prefetch_related("a__players", "b__players")
    )

    for match in played:
        score = match.score or {}
        won = {"a": int(score.get("a") or 0), "b": int(score.get("b") or 0)}

        # Nothing reported yet, or a walkover recorded without a score.
        if won["a"] == 0 and won["b"] == 0:
            continue

        for side, entrant in (("a", match.a), ("b", match.b)):
            other = "b" if side == "a" else "a"

            for player in entrant.players.all():
                row = counts.setdefault(player.id, {"played": 0, "won": 0, "lost": 0})
                row["played"] += won[side] + won[other]
                row["won"] += won[side]
                row["lost"] += won[other]

    return counts


@transaction.atomic
def sync_tournament_stats(link) -> None:
    """
    Bring the board in line with the tournament as it currently stands.

    Safe to call after every reported result: the per-game numbers are set from
    the match rows rather than added to, so calling it twice changes nothing and
    correcting a result corrects the board.
    """
    table = link.stats_table
    if table is None:
        return

    _retract_if_no_longer_won(link, table)

    columns = _columns_by_role(table)
    tracked = {
        role: columns[role]
        for role in (StatsColumn.Role.PLAYED, StatsColumn.Role.WON, StatsColumn.Role.LOST)
        if role in columns
    }
    if not tracked:
        return

    # Everyone playing gets a row, so the board doubles as tonight's team sheet.
    _rows_for(table, tournament_players(link.tournament))

    counts = _game_counts(link.tournament)
    rows = {row.player_id: row for row in table.rows.all() if row.player_id}

    # Every player in this tournament is written, not only those with games —
    # a cleared result drops someone's count back to zero, and skipping the
    # players missing from `counts` would leave the old number standing.
    empty = {"played": 0, "won": 0, "lost": 0}

    for player in tournament_players(link.tournament):
        row = rows.get(player.id)
        if row is None:
            continue

        tally = counts.get(player.id, empty)

        for role, column in tracked.items():
            StatsEntry.objects.update_or_create(
                row=row, column=column, defaults={"count": tally[role]}
            )


@transaction.atomic
def strip_tournament_from_board(link) -> None:
    """
    Take a tournament's contribution off the board before it is deleted.

    Cascading the link away is not enough: the numbers it wrote stay behind, so
    a deleted tournament would leave permanent wins on a board with nothing
    behind them — the clutter that makes a board stop being trustworthy.

    Two different sums, undone two different ways:

    - The trophy is *incremental*, so it is decremented, and only for the people
      this link actually credited. Everyone else's came from other tournaments.
    - The per-game counts are *set* from the tournament's match rows, so they
      cannot be subtracted. They are zeroed for the players this tournament
      brought, then left for the next sync to refill from whatever still exists.

    Rows are kept. A player on a board is a person the crew tracks, not a
    by-product of one night, and removing them would take tallies other
    tournaments wrote.
    """
    table = link.stats_table
    if table is None:
        return

    _retract_award(link, table)
    _zero_game_counts(link, table)


def _retract_award(link, table) -> None:
    """Hand back the trophy this link gave out, if it gave one."""
    if not link.awarded:
        return

    column = _award_column(link, table)
    if column is None:
        return

    credited = link_awarded_players(link)
    if not credited:
        return

    for entry in StatsEntry.objects.filter(
        column=column, count__gt=0, row__table=table, row__player_id__in=credited
    ):
        StatsEntry.objects.filter(pk=entry.pk).update(count=F("count") - 1)


def _zero_game_counts(link, table) -> None:
    """
    Clear the played/won/lost this tournament wrote.

    Zeroed rather than subtracted because `sync_tournament_stats` *sets* these
    from one tournament's matches — there is no per-tournament contribution to
    take away. Any other tournament still linked to this table rewrites them on
    its next sync.
    """
    columns = _columns_by_role(table)
    tracked = [
        columns[role]
        for role in (StatsColumn.Role.PLAYED, StatsColumn.Role.WON, StatsColumn.Role.LOST)
        if role in columns
    ]
    if not tracked:
        return

    player_ids = [player.id for player in tournament_players(link.tournament)]
    if not player_ids:
        return

    StatsEntry.objects.filter(
        column__in=tracked, row__table=table, row__player_id__in=player_ids
    ).update(count=0)


def _award_column(link, table):
    """Where a tournament win lands: the linked column, or the table's own."""
    if link.column_id:
        return link.column
    return _columns_by_role(table).get(StatsColumn.Role.TOURNAMENTS_WON)


def _retract_if_no_longer_won(link, table) -> None:
    """
    Take a trophy back when the result that earned it no longer stands.

    Clearing a final, or correcting it in someone else's favour, must undo the
    credit as well as the games — a board still showing a win for a bracket that
    now says otherwise is worse than one briefly behind. Clearing `awarded` lets
    the replayed final award again.
    """
    if not link.awarded:
        return

    column = _award_column(link, table)
    if column is None:
        return

    still_winning = {player.id for player in winning_players(link.tournament)}
    credited = StatsEntry.objects.filter(
        column=column, count__gt=0, row__player_id__isnull=False
    ).select_related("row")

    # Only the people this link credited: everyone else's trophies came from
    # other tournaments and are none of this one's business.
    for entry in credited:
        if entry.row.player_id in still_winning:
            continue
        if entry.row.player_id in link_awarded_players(link):
            StatsEntry.objects.filter(pk=entry.pk).update(count=F("count") - 1)

    if still_winning != link_awarded_players(link):
        link.awarded = False
        link.awarded_at = None
        link.awarded_player_ids = []
        link.save(update_fields=["awarded", "awarded_at", "awarded_player_ids"])


def link_awarded_players(link) -> set:
    """
    Who this link handed a trophy to.

    Recorded on the link rather than inferred, because by the time a result is
    corrected the bracket no longer knows who used to be winning.
    """
    return set(link.awarded_player_ids or [])


def winning_players(tournament):
    """
    The `Player`s who won `tournament`, or an empty list if nobody has yet.

    Asks the standings module who won rather than looking for a final and
    reading its winner. Every format decides a champion differently — a grand
    final that may or may not be played, a losers final that must not be
    mistaken for one — and that knowledge already lives in one place. Repeating
    it here would be a second copy to drift (plan §5).
    """
    entrant_id = champion_entrant_id(tournament)
    if entrant_id is None:
        return []

    entrant = tournament.entrants.filter(id=entrant_id).prefetch_related("players").first()
    if entrant is None:
        return []

    return list(entrant.players.all())


@transaction.atomic
def apply_tournament_result(link) -> int:
    """
    Credit the winners now the tournament is over. Returns how many were marked.

    Idempotent by way of `link.awarded`: correcting a bracket after it finished
    re-runs this, and a second pass must not hand out a second set of trophies.

    A winner with no row gets one created rather than being dropped — the
    alternative is a tournament that silently awards nothing because somebody
    was never added to the board by hand.
    """
    if link.awarded:
        return 0

    players = winning_players(link.tournament)
    if not players:
        return 0

    table = link.stats_table
    if table is None:
        return 0

    # A link made against a single hand-made column marks that one; a table link
    # uses the tournaments-won column the table was set up with.
    column = _award_column(link, table)

    if column is None:
        return 0

    _rows_for(table, players)
    rows = {row.player_id: row for row in table.rows.all() if row.player_id}

    awarded = 0

    for player in players:
        row = rows.get(player.id)
        if row is None:
            continue

        entry, created = StatsEntry.objects.get_or_create(
            row=row, column=column, defaults={"count": 1}
        )
        if not created:
            # F() rather than read-modify-write: two tournaments finishing at
            # once must not overwrite each other's increment.
            StatsEntry.objects.filter(pk=entry.pk).update(count=F("count") + 1)

        awarded += 1

    link.awarded = True
    link.awarded_at = timezone.now()
    link.awarded_player_ids = [player.id for player in players]
    link.save(update_fields=["awarded", "awarded_at", "awarded_player_ids"])

    return awarded
