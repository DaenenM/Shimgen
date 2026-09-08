"""
Swiss.

Nobody is eliminated; each round pairs entrants on similar scores. Rounds are
⌈log₂(n)⌉, which is the minimum needed for a single clear winner (plan §3).

Unlike every other format, Swiss cannot be generated up front — round two's
pairings depend on round one's results. So `generate_swiss` creates only the
first round, and `pair_next_round` is called as each round completes.

The hard constraint is **no rematches**. Greedy pairing down the score groups
fails on it: the last two entrants left in a group have often already played,
and by then there is nobody to swap with. This uses backtracking, which for the
group sizes a game night produces is instant and always finds a valid pairing if
one exists. Where none exists (everyone remaining has played everyone else), it
degrades to allowing the rematch rather than refusing to pair at all — a
repeated fixture is much better than a stalled tournament.
"""

import math

from django.db import models

from ..models import Match
from ..standings import compute_standings
from .best_of import best_of_for

__all__ = ["generate_swiss", "pair_next_round", "swiss_round_count"]


def swiss_round_count(entrant_count: int) -> int:
    """⌈log₂(n)⌉ — enough rounds to separate a single winner."""
    if entrant_count < 2:
        return 0
    return max(1, math.ceil(math.log2(entrant_count)))


def generate_swiss(tournament, entrants):
    """
    Create round one only.

    Entrants arrive in seed order, and the standard opening pairs the top half
    against the bottom half: 1 v 5, 2 v 6, and so on for eight players.
    """
    if len(entrants) < 2:
        raise ValueError("A Swiss tournament needs at least two entrants.")

    ordered = list(entrants)
    half = len(ordered) // 2
    pairs = list(zip(ordered[:half], ordered[half:], strict=False))

    # Odd count: whoever is left over receives a bye this round.
    leftover = ordered[2 * half :]

    total = swiss_round_count(len(ordered))
    _create_round(tournament, 1, pairs, leftover, total)

    return Match.objects.filter(tournament=tournament)


def pair_next_round(tournament):
    """
    Pair the next round from the current standings.

    Returns the created matches, or an empty list when the tournament has
    already played its full complement of rounds.
    """
    entrants = list(tournament.entrants.all())
    total = swiss_round_count(len(entrants))
    last = tournament.matches.aggregate(models.Max("round_no"))["round_no__max"] or 0

    if last >= total:
        return []

    table = compute_standings(tournament)
    played = _previous_opponents(tournament)

    # Standings are already ordered best first, which groups equal scores
    # together — exactly the order Swiss pairs within.
    ranked = [row.entrant_id for row in table]
    by_id = {e.id: e for e in entrants}

    pairs, bye = _pair(ranked, played, had_bye=_entrants_with_a_bye(tournament))

    _create_round(
        tournament,
        last + 1,
        [(by_id[a], by_id[b]) for a, b in pairs],
        [by_id[bye]] if bye else [],
        total,
    )

    return Match.objects.filter(tournament=tournament, round_no=last + 1)


def _pair(
    ranked: list[int], played: set[frozenset], had_bye: set[int] | None = None
) -> tuple[list[tuple], int | None]:
    """
    Pair `ranked` (best first) avoiding any fixture already in `played`.

    Returns (pairs, bye). Backtracking: take the highest unpaired entrant and
    try each remaining opponent in rank order, so the closest in score wins.
    """
    bye = None
    remaining = list(ranked)
    had_bye = had_bye or set()

    if len(remaining) % 2:
        # The bye goes to the lowest-ranked entrant who has not already had one
        # — it is worth least there, and nobody should sit out twice while
        # someone else has played every round.
        for entrant_id in reversed(remaining):
            if entrant_id not in had_bye:
                bye = entrant_id
                break

        # Everyone has had one already; fall back to the lowest ranked.
        if bye is None:
            bye = remaining[-1]

        remaining.remove(bye)

    pairs = _search(remaining, played)

    if pairs is None:
        # Every arrangement needs a rematch. Pair greedily and accept it rather
        # than leaving the round unplayable.
        pairs = [(remaining[i], remaining[i + 1]) for i in range(0, len(remaining), 2)]

    return pairs, bye


def _search(remaining: list[int], played: set[frozenset]) -> list[tuple] | None:
    """Depth-first search for a rematch-free perfect pairing."""
    if not remaining:
        return []

    first, rest = remaining[0], remaining[1:]

    for index, candidate in enumerate(rest):
        if frozenset((first, candidate)) in played:
            continue

        tail = _search(rest[:index] + rest[index + 1 :], played)
        if tail is not None:
            return [(first, candidate), *tail]

    return None


def _entrants_with_a_bye(tournament) -> set[int]:
    """Entrants who have already sat a round out — a bye is a one-sided match."""
    return set(
        tournament.matches.filter(b__isnull=True, a__isnull=False).values_list("a_id", flat=True)
    )


def _previous_opponents(tournament) -> set[frozenset]:
    """Every fixture already played, as unordered pairs."""
    return {
        frozenset((m.a_id, m.b_id))
        for m in tournament.matches.exclude(a__isnull=True).exclude(b__isnull=True)
    }


def _create_round(tournament, round_no, pairs, byes, total_rounds):
    """Write one round's matches, plus a bye row for anyone sitting out."""
    settings = tournament.settings or {}
    best_of = best_of_for(settings, round_no, total_rounds)

    matches = [
        Match(
            tournament=tournament,
            round_no=round_no,
            position=position,
            bracket=Match.Bracket.MAIN,
            a=a,
            b=b,
            best_of=best_of,
        )
        for position, (a, b) in enumerate(pairs)
    ]

    # A bye is recorded as a match with one side empty and the winner already
    # set, so the entrant is credited with the round without a fixture.
    matches += [
        Match(
            tournament=tournament,
            round_no=round_no,
            position=len(pairs) + offset,
            bracket=Match.Bracket.MAIN,
            a=entrant,
            b=None,
            winner=entrant,
            best_of=best_of,
        )
        for offset, entrant in enumerate(byes)
    ]

    Match.objects.bulk_create(matches)
    return matches
