"""
Standings.

Computed from Match rows on every request, never stored (plan §5). Denormalised
win/loss counters are the classic source of "the leaderboard says 7-2 but the
history shows 6-3" — recomputing costs one query and cannot drift.

Points are configurable per tournament:

    {"points": {"win": 3, "draw": 1, "loss": 0}}

Tiebreakers, applied in order:
  1. points
  2. head-to-head between the tied entrants
  3. Buchholz — the summed score of everyone you played, which rewards having
     faced a hard schedule. The standard Swiss tiebreak (plan §3).
  4. wins, then label, so the order is stable rather than arbitrary
"""

from dataclasses import dataclass, field

DEFAULT_POINTS = {"win": 3, "draw": 1, "loss": 0}


@dataclass
class Standing:
    """One row of the table."""

    entrant_id: int
    label: str
    played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    points: float = 0.0
    buchholz: float = 0.0
    # Opponents faced, used to compute Buchholz once every score is known.
    opponents: list[int] = field(default_factory=list)

    @property
    def win_rate(self) -> float:
        return self.wins / self.played if self.played else 0.0

    def as_dict(self) -> dict:
        return {
            "entrant_id": self.entrant_id,
            "label": self.label,
            "played": self.played,
            "wins": self.wins,
            "draws": self.draws,
            "losses": self.losses,
            "points": self.points,
            "buchholz": self.buchholz,
            "win_rate": round(self.win_rate, 3),
        }


def compute_standings(tournament) -> list[Standing]:
    """Build the table for `tournament`, best first."""
    config = {**DEFAULT_POINTS, **((tournament.settings or {}).get("points") or {})}

    rows = {
        entrant.id: Standing(entrant_id=entrant.id, label=entrant.label)
        for entrant in tournament.entrants.all()
    }

    played = (
        tournament.matches.filter(winner__isnull=False)
        .exclude(a__isnull=True)
        .exclude(b__isnull=True)
        .select_related("a", "b", "winner")
    )

    head_to_head: dict[tuple[int, int], int] = {}

    for match in played:
        a, b = rows.get(match.a_id), rows.get(match.b_id)
        if a is None or b is None:
            continue

        a.played += 1
        b.played += 1
        a.opponents.append(b.entrant_id)
        b.opponents.append(a.entrant_id)

        if _is_draw(match):
            a.draws += 1
            b.draws += 1
            a.points += config["draw"]
            b.points += config["draw"]
            continue

        winner, loser = (a, b) if match.winner_id == match.a_id else (b, a)
        winner.wins += 1
        winner.points += config["win"]
        loser.losses += 1
        loser.points += config["loss"]

        head_to_head[(winner.entrant_id, loser.entrant_id)] = (
            head_to_head.get((winner.entrant_id, loser.entrant_id), 0) + 1
        )

    _apply_buchholz(rows)

    return _sorted(list(rows.values()), head_to_head)


def _is_draw(match) -> bool:
    """
    A draw is a resolved match whose two sides finished level.

    Only reachable in formats that allow one — round robin with a draw value
    configured. Elimination brackets cannot produce it, since a match only
    resolves when somebody reaches wins_needed.
    """
    score = match.score or {}
    return bool(score) and score.get("a") == score.get("b")


def _apply_buchholz(rows: dict) -> None:
    """
    Sum each entrant's opponents' points.

    Must run after every row's points are final, which is why it is a second
    pass rather than being folded into the loop above.
    """
    for row in rows.values():
        row.buchholz = sum(rows[opponent].points for opponent in row.opponents if opponent in rows)


def _sorted(rows: list[Standing], head_to_head: dict) -> list[Standing]:
    """
    Order the table, resolving ties in the documented sequence.

    Head-to-head is applied as a local comparison between adjacent tied
    entrants rather than a global sort key, because it is not transitive: A can
    beat B, B beat C and C beat A. Attempting to sort on it directly produces
    an order that depends on the input, which is worse than leaving the cycle
    to be broken by Buchholz.
    """
    rows.sort(key=lambda r: (-r.points, -r.buchholz, -r.wins, r.label))

    # One stable pass: swap adjacent pairs that are level on points and
    # Buchholz where the lower one won the meeting.
    for i in range(len(rows) - 1):
        upper, lower = rows[i], rows[i + 1]

        if (upper.points, upper.buchholz) != (lower.points, lower.buchholz):
            continue

        upper_won = head_to_head.get((upper.entrant_id, lower.entrant_id), 0)
        lower_won = head_to_head.get((lower.entrant_id, upper.entrant_id), 0)

        if lower_won > upper_won:
            rows[i], rows[i + 1] = lower, upper

    return rows


def placements(tournament) -> dict[int, int]:
    """
    Map entrant id -> finishing position, sharing a position on an exact tie.

    Used for the stat tracker's placement distribution.
    """
    table = compute_standings(tournament)
    result: dict[int, int] = {}

    previous_key = None
    position = 0

    for index, row in enumerate(table, start=1):
        key = (row.points, row.buchholz, row.wins)
        if key != previous_key:
            position = index
            previous_key = key
        result[row.entrant_id] = position

    return result


def elimination_placements(tournament) -> dict[int, int]:
    """
    Finishing positions for a knockout bracket.

    Points are meaningless here — a bracket ranks by how far you got — so
    entrants are ordered by how deep they went, and everyone knocked out at the
    same depth shares a position, as brackets are conventionally reported.

    Depth cannot be `round_no`, and it cannot be "the best bracket reached"
    either. In double elimination the two brackets number rounds independently,
    and an entrant who drops to losers and survives three more rounds has
    finished *higher* than one who dropped at the same point and lost
    immediately — even though both peaked in the same winners round.

    So depth is the furthest point an entrant reached along the path they
    actually took: their last losers-bracket appearance if they were dropped,
    otherwise their last winners appearance.
    """
    reached: dict[int, tuple] = {}

    # Every appearance counts, including a slot whose opponent is undecided:
    # ignoring the round an entrant has already advanced into would tie a
    # finalist with the entrant they knocked out in round one.
    for match in tournament.matches.all():
        for entrant_id in (match.a_id, match.b_id):
            if entrant_id is None:
                continue
            reached[entrant_id] = _further(reached.get(entrant_id), _depth_of(match))

    winner = champion_entrant_id(tournament)

    # Losing a decided match ranks you below its winner at equal depth: the two
    # who contest the losers final both reach it, but one finished third and the
    # other fourth. Scoped to the match that *ended* each entrant's run —
    # counting any earlier loss would demote someone who lost in the winners
    # bracket and then won several losers rounds.
    beaten = {
        loser
        for loser, depth in (
            (
                match.b_id if match.winner_id == match.a_id else match.a_id,
                _depth_of(match),
            )
            for match in tournament.matches.filter(winner__isnull=False)
            .exclude(a__isnull=True)
            .exclude(b__isnull=True)
        )
        if reached.get(loser) == depth
    }

    ordered = sorted(
        reached,
        key=lambda e: (_negate(reached[e]), e != winner, e in beaten),
    )

    result: dict[int, int] = {}
    previous_depth = None
    position = 0

    for index, entrant_id in enumerate(ordered, start=1):
        # Depth alone would tie the two sides of a decided match; the loss
        # separates them.
        depth = (reached[entrant_id], entrant_id in beaten)

        # Only the actual champion takes 1st. Without the None guard a bracket
        # with no results reports every entrant as 1st — they have all "reached"
        # round one — which reads as though everybody won.
        if winner is not None and entrant_id == winner:
            result[entrant_id] = 1
            previous_depth, position = None, 1
            continue

        if depth != previous_depth:
            # Offset by one while the tournament is unfinished: 1st belongs to
            # the champion alone, so the deepest survivors are joint 2nd until
            # somebody actually wins it.
            position = index if winner is not None else index + 1
            previous_depth = depth

        result[entrant_id] = position

    return result


# Which bracket a finish belongs to, ranked.
#
#   losers  a run through the consolation bracket
#   main    the winners bracket
#   final   the grand final, which beats everything
#
# The third-place playoff is deliberately absent: it is not a stage of its own
# but a parallel match to the final, contested by the two who lost the
# semifinals. It is handled separately in `_depth_of`, which pins it just below
# the final — ranking it as an ordinary bracket put its contestants either below
# the first-round losers or above the champion, depending which way it was
# ordered.
_BRACKET_RANK = {"losers": 0, "main": 1, "final": 2}

# A losers-bracket or grand-final run supersedes an earlier winners appearance
# rather than being compared to it: it happened afterwards and is what actually
# ended the entrant's tournament.
_SUPERSEDING_RANKS = (0, 2)


def _depth_of(match) -> tuple[int, int]:
    """
    (bracket rank, round) for one appearance, comparable across brackets.

    A third-place playoff reports the winners round it belongs beside — its
    contestants lost the semifinal, so they rank immediately below the two who
    reached the final and above everyone knocked out earlier.
    """
    if match.bracket == "third":
        # Just under the final's round, so finalists still outrank them.
        return (1, match.round_no - 0.5)

    return (_BRACKET_RANK.get(match.bracket, 0), match.round_no)


def _further(current, candidate) -> tuple[int, int]:
    """
    Combine two appearances into the one that represents the better finish.

    Within a bracket, later is better. Across brackets it is not a simple
    max: once an entrant has dropped to losers, their losers run is what
    decides their placing, and their earlier winners-bracket rounds say
    nothing more about it. So a losers appearance always supersedes a winners
    one, while the grand final supersedes everything.
    """
    if current is None:
        return candidate

    # Same bracket: the later round wins.
    if current[0] == candidate[0]:
        return max(current, candidate)

    # Between two superseding runs — say a losers run then a third-place
    # playoff — the higher-ranked one is the later finish.
    if current[0] in _SUPERSEDING_RANKS and candidate[0] in _SUPERSEDING_RANKS:
        return max(current, candidate)

    # Otherwise one of them is an ordinary winners round, and any superseding
    # run replaces it outright.
    return candidate if candidate[0] in _SUPERSEDING_RANKS else current


def _negate(depth: tuple[int, int]) -> tuple[int, int]:
    """Descending sort key for a depth tuple."""
    return (-depth[0], -depth[1])


def champion_entrant_id(tournament):
    """
    The entrant that won the tournament, or None while it is still running.

    Public because the stats boards need the same answer when a linked
    tournament finishes, and there must be exactly one implementation of "who
    won" for any format.

    Must be the winner of a *terminal* match — one nothing advances out of.
    Taking the last decided match instead would crown whoever won a first-round
    bye, before a single game had been played.
    """
    decided = (
        tournament.matches.filter(winner__isnull=False)
        # Both sides present: a terminal match that was a walkover decided
        # nothing, so its "winner" is not the champion.
        .exclude(a__isnull=True)
        .exclude(b__isnull=True)
        # A third-place match is terminal but decides third, not first.
        .exclude(bracket="third")
        .select_related("next_match_win")
    )

    # Terminal means nothing further will actually be played. A grand final
    # whose decider was never reached counts: the decider exists but sits empty
    # because the undefeated side held, so the grand final settled the title.
    candidates = [
        match
        for match in decided
        if match.next_match_win is None
        or (match.next_match_win.a_id is None and match.next_match_win.b_id is None)
    ]

    if not candidates:
        return None

    # With no grand final there are two terminal matches — the winners final and
    # the losers final — and only the winners side decides the title. Ordering
    # by bracket depth first picks the right one; ordering by round alone would
    # crown the losers-bracket winner, whose round numbers run higher.
    final = max(candidates, key=lambda m: (*_depth_of(m), m.position))
    return final.winner_id


def standings_payload(tournament) -> list[dict]:
    """Serialisable standings for the API."""
    formats = tournament.__class__.Format

    if tournament.format in (formats.SINGLE, formats.DOUBLE):
        # A knockout ranks by how far you got, not by points.
        places = elimination_placements(tournament)
        entrants = {e.id: e for e in tournament.entrants.all()}
        return [
            {"entrant_id": eid, "label": entrants[eid].label, "placement": place}
            for eid, place in sorted(places.items(), key=lambda kv: kv[1])
            if eid in entrants
        ]

    return [row.as_dict() for row in compute_standings(tournament)]
