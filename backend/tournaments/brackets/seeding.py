"""
Seeding and bye placement for elimination brackets.

The whole point of seeding is that the two strongest entrants meet in the final,
not in round one. Getting the ordering wrong is the classic "this bracket is
wrong" bug — it looks plausible and is completely broken — so the standard
algorithm is used and tested rather than approximated.
"""

import math
import random

__all__ = ["bracket_positions", "next_power_of_two", "seed_entrants"]


def next_power_of_two(n: int) -> int:
    """Smallest power of two >= n. 5 -> 8, 8 -> 8, 9 -> 16."""
    if n <= 1:
        return 1
    return 1 << (n - 1).bit_length()


def bracket_positions(size: int) -> list[int]:
    """
    Return seed numbers in bracket order for a bracket of `size` slots.

    Built by the standard fold: start with [1, 2], and on each doubling every
    seed `s` is paired with `(2 * len + 1) - s`, appended in place.

        size 2 -> [1, 2]
        size 4 -> [1, 4, 3, 2]
        size 8 -> [1, 8, 5, 4, 3, 6, 7, 2]

    Read as consecutive pairs, that is exactly the first round: in an 8-bracket
    1 plays 8, 4 plays 5, and so on. The property that matters is that seeds 1
    and 2 land in opposite halves, 1–4 in opposite quarters, and so on down —
    so the best entrants can only meet as late as possible.

    `size` must be a power of two; callers pad with byes via next_power_of_two.
    """
    if size < 1 or size & (size - 1):
        raise ValueError(f"Bracket size must be a power of two, got {size}.")

    order = [1]
    while len(order) < size:
        pair_sum = 2 * len(order) + 1
        expanded = []
        for seed in order:
            expanded.append(seed)
            expanded.append(pair_sum - seed)
        order = expanded

    return order


def seed_entrants(entrants, method: str = "random", rng=None) -> list:
    """
    Order `entrants` by seed, best first.

    Methods:
      manual  — respect the `seed` already set on each entrant. Unseeded
                entrants sort last, in their existing order.
      random  — shuffle. The default: most game nights are not ranked, and
                pretending otherwise produces a fake-precise bracket.
      rating  — strongest first by Elo in this tournament's mode (plan §3).
                This is where ratings feed back into the bracket.

    `rng` is injectable so tests are deterministic without patching globals.
    """
    ordered = list(entrants)

    if method == "manual":
        # Unseeded entrants must not sort ahead of seed 1; inf parks them last
        # while keeping their relative order (Python's sort is stable).
        return sorted(ordered, key=lambda e: (e.seed is None, e.seed or math.inf))

    if method == "rating":
        return sorted(ordered, key=_rating_of, reverse=True)

    (rng or random).shuffle(ordered)
    return ordered


def _rating_of(entrant) -> float:
    """
    Mean Elo of the players behind an entrant, defaulting to 1200.

    Mean rather than sum so a 3-player team is not automatically "stronger"
    than a 2-player one, and 1200 (the Rating default) so an unrated entrant
    sits mid-field instead of at the bottom.
    """
    mode_id = entrant.tournament.mode_id
    if mode_id is None:
        return 1200.0

    ratings = [
        rating.elo
        for player in entrant.players.all()
        for rating in player.ratings.all()
        if rating.mode_id == mode_id
    ]
    return sum(ratings) / len(ratings) if ratings else 1200.0
