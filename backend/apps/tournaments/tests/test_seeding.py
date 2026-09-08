"""
Seeding tests.

Seed order is the classic silent bracket bug: a wrong order still renders a
perfectly plausible-looking bracket, and nobody notices until seeds 1 and 2 meet
in round one. These assert the structural property directly rather than trusting
a hardcoded list.
"""

import pytest

from apps.tournaments.brackets.seeding import (
    bracket_positions,
    next_power_of_two,
    seed_entrants,
)


@pytest.mark.parametrize(
    ("n", "expected"),
    [(1, 1), (2, 2), (3, 4), (4, 4), (5, 8), (8, 8), (9, 16), (33, 64), (64, 64)],
)
def test_next_power_of_two(n, expected):
    assert next_power_of_two(n) == expected


@pytest.mark.parametrize(
    ("size", "expected"),
    [
        (2, [1, 2]),
        (4, [1, 4, 2, 3]),
        (8, [1, 8, 4, 5, 2, 7, 3, 6]),
    ],
)
def test_known_bracket_orders(size, expected):
    """
    The standard fold. Read as pairs, an 8-bracket is 1v8, 4v5, 2v7, 3v6 — the
    top half holds seeds 1 and 4/5, the bottom half 2 and 3/6, so 1 and 2 can
    only meet in the final.
    """
    assert bracket_positions(size) == expected


@pytest.mark.parametrize("size", [2, 4, 8, 16, 32, 64])
def test_bracket_is_a_permutation_of_all_seeds(size):
    assert sorted(bracket_positions(size)) == list(range(1, size + 1))


@pytest.mark.parametrize("size", [2, 4, 8, 16, 32, 64])
def test_every_first_round_pair_sums_to_size_plus_one(size):
    """1 plays 8, 2 plays 7, 4 plays 5 — the defining property of a seeded bracket."""
    order = bracket_positions(size)
    pairs = [(order[i], order[i + 1]) for i in range(0, size, 2)]

    assert all(a + b == size + 1 for a, b in pairs)


@pytest.mark.parametrize("size", [4, 8, 16, 32, 64])
def test_top_two_seeds_are_in_opposite_halves(size):
    """Seeds 1 and 2 must not be able to meet before the final."""
    order = bracket_positions(size)

    assert (order.index(1) < size // 2) != (order.index(2) < size // 2)


@pytest.mark.parametrize("size", [8, 16, 32, 64])
def test_top_four_seeds_are_in_separate_quarters(size):
    """And 1–4 must not meet before the semifinal."""
    quarter = size // 4
    order = bracket_positions(size)

    quarters = {order.index(seed) // quarter for seed in (1, 2, 3, 4)}
    assert len(quarters) == 4


@pytest.mark.parametrize("size", [0, 3, 5, 6, 7, 12])
def test_non_power_of_two_is_rejected(size):
    with pytest.raises(ValueError, match="power of two"):
        bracket_positions(size)


# ── seed_entrants ─────────────────────────────────────────────────────────────


class FakeEntrant:
    """Stands in for a model instance; seeding never touches the database."""

    def __init__(self, label, seed=None):
        self.label = label
        self.seed = seed

    def __repr__(self):
        return self.label


def test_manual_seeding_respects_existing_seeds():
    entrants = [FakeEntrant("c", 3), FakeEntrant("a", 1), FakeEntrant("b", 2)]

    assert [e.label for e in seed_entrants(entrants, "manual")] == ["a", "b", "c"]


def test_manual_seeding_puts_unseeded_entrants_last():
    """An unseeded entrant must not sort ahead of seed 1."""
    entrants = [FakeEntrant("x"), FakeEntrant("a", 1), FakeEntrant("y")]

    ordered = seed_entrants(entrants, "manual")

    assert ordered[0].label == "a"
    # Stable: the two unseeded keep their original relative order.
    assert [e.label for e in ordered[1:]] == ["x", "y"]


def test_random_seeding_keeps_every_entrant():
    import random

    entrants = [FakeEntrant(str(i)) for i in range(10)]

    ordered = seed_entrants(entrants, "random", rng=random.Random(42))

    assert sorted(e.label for e in ordered) == sorted(e.label for e in entrants)
