"""
Single elimination.

Generates the full match tree up front and wires `next_match_win` on every
match, so reporting a result is just "push the winner along the edge" — the same
routine that serves every other format (plan §5).

Byes are handled by padding to the next power of two. A first-round match with
only one entrant is resolved immediately at generation time, so nobody is asked
to click a winner for a match that was never played.
"""

from ..models import Match
from .best_of import best_of_for
from .seeding import bracket_positions, next_power_of_two

__all__ = ["generate_single_elimination"]


def generate_single_elimination(tournament, entrants, *, third_place=False):
    """
    Build the bracket for `entrants`, already in seed order (best first).

    Returns the created Match rows. The caller is responsible for having
    cleared any previous matches.
    """
    count = len(entrants)
    if count < 2:
        raise ValueError("A bracket needs at least two entrants.")

    size = next_power_of_two(count)
    total_rounds = size.bit_length() - 1
    settings = tournament.settings or {}

    # Seed order -> bracket slots. Slots beyond `count` are byes: seed 6 in a
    # 5-entrant bracket has nobody in it, so the entrant it faces advances.
    order = bracket_positions(size)
    slots = [entrants[s - 1] if s <= count else None for s in order]

    rounds: list[list[Match]] = []

    # ── Round 1 ───────────────────────────────────────────────────────────────
    first_round = []
    for position, index in enumerate(range(0, size, 2)):
        a, b = slots[index], slots[index + 1]
        match = Match(
            tournament=tournament,
            round_no=1,
            position=position,
            bracket=Match.Bracket.MAIN,
            a=a,
            b=b,
            best_of=best_of_for(settings, 1, total_rounds),
        )
        first_round.append(match)

    Match.objects.bulk_create(first_round)
    rounds.append(first_round)

    # ── Later rounds ──────────────────────────────────────────────────────────
    for round_no in range(2, total_rounds + 1):
        previous = rounds[-1]
        current = [
            Match(
                tournament=tournament,
                round_no=round_no,
                position=position,
                bracket=Match.Bracket.MAIN,
                best_of=best_of_for(settings, round_no, total_rounds),
            )
            for position in range(len(previous) // 2)
        ]
        Match.objects.bulk_create(current)

        # Wire each pair of feeders into the match above them.
        for index, match in enumerate(previous):
            match.next_match_win = current[index // 2]
        Match.objects.bulk_update(previous, ["next_match_win"])

        rounds.append(current)

    # ── Third-place match ─────────────────────────────────────────────────────
    # Contested by the two semifinal losers, so it only exists when there is a
    # semifinal round to lose (4+ entrants).
    if third_place and total_rounds >= 2:
        semifinals = rounds[-2]
        third = Match.objects.create(
            tournament=tournament,
            round_no=total_rounds,
            # Sits beside the final, which occupies position 0.
            position=1,
            bracket=Match.Bracket.THIRD,
            best_of=best_of_for(settings, total_rounds, total_rounds),
        )
        for match in semifinals:
            match.next_match_lose = third
        Match.objects.bulk_update(semifinals, ["next_match_lose"])

    # Byes resolve now: a first-round match with one side empty was never a
    # real match, and the entrant in it should already be in round two.
    _resolve_byes(rounds[0])

    return Match.objects.filter(tournament=tournament)


def _resolve_byes(first_round):
    """Advance entrants whose first-round opponent slot is empty."""
    from .advance import advance_winner

    for match in first_round:
        if match.a_id and not match.b_id:
            advance_winner(match, match.a, bye=True)
        elif match.b_id and not match.a_id:
            advance_winner(match, match.b, bye=True)
