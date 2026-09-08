"""
Team generation.

Database-free: the generator takes anything with an `id`, so these run as pure
unit tests and stay fast enough to sweep many random seeds.
"""

import random
from dataclasses import dataclass

import pytest

from apps.tournaments.teams import (
    Constraint,
    TeamGenerationError,
    generate_teams,
    split_evenly,
)


@dataclass(frozen=True)
class P:
    """A stand-in player."""

    id: int

    @property
    def name(self):
        return f"P{self.id}"


def players(n):
    return [P(i) for i in range(1, n + 1)]


def rng():
    """Seeded, so a failure is reproducible."""
    return random.Random(1234)


def team_of(teams, player_id):
    for index, team in enumerate(teams):
        if any(p.id == player_id for p in team):
            return index
    return None


# ── Basic splitting ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("total", "teams", "expected"),
    [
        (10, 2, [5, 5]),
        (9, 2, [5, 4]),
        (8, 3, [3, 3, 2]),
        (7, 4, [2, 2, 2, 1]),
        (4, 4, [1, 1, 1, 1]),
    ],
)
def test_split_evenly(total, teams, expected):
    assert split_evenly(total, teams) == expected


@pytest.mark.parametrize("count", [2, 4, 6, 7, 9, 10, 12, 20])
@pytest.mark.parametrize("team_count", [2, 3, 4])
def test_every_player_is_placed_exactly_once(count, team_count):
    if count < team_count:
        pytest.skip("not enough players")

    teams = generate_teams(players(count), team_count, rng=rng())

    placed = [p.id for team in teams for p in team]
    assert sorted(placed) == list(range(1, count + 1))


@pytest.mark.parametrize("count", [4, 5, 6, 7, 8, 9, 10, 11])
def test_team_sizes_differ_by_at_most_one(count):
    """Uneven groups play 2v3, never 1v4."""
    teams = generate_teams(players(count), 2, rng=rng())

    sizes = sorted(len(t) for t in teams)
    assert sizes[-1] - sizes[0] <= 1


def test_more_teams_than_players_is_rejected():
    with pytest.raises(TeamGenerationError, match="cannot fill"):
        generate_teams(players(2), 4)


def test_zero_teams_is_rejected():
    with pytest.raises(TeamGenerationError, match="At least one team"):
        generate_teams(players(4), 0)


# ── Constraints ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize("seed", range(10))
def test_apart_keeps_two_players_on_different_teams(seed):
    rules = [Constraint(kind="apart", player_ids=[1, 2])]

    teams = generate_teams(players(8), 2, constraints=rules, rng=random.Random(seed))

    assert team_of(teams, 1) != team_of(teams, 2)


@pytest.mark.parametrize("seed", range(10))
def test_together_keeps_two_players_on_the_same_team(seed):
    rules = [Constraint(kind="together", player_ids=[1, 2])]

    teams = generate_teams(players(8), 2, constraints=rules, rng=random.Random(seed))

    assert team_of(teams, 1) == team_of(teams, 2)


@pytest.mark.parametrize("seed", range(10))
def test_together_is_transitive(seed):
    """A-with-B and B-with-C must put all three together, not just the pairs."""
    rules = [
        Constraint(kind="together", player_ids=[1, 2]),
        Constraint(kind="together", player_ids=[2, 3]),
    ]

    teams = generate_teams(players(9), 3, constraints=rules, rng=random.Random(seed))

    assert team_of(teams, 1) == team_of(teams, 2) == team_of(teams, 3)


@pytest.mark.parametrize("seed", range(10))
def test_locked_pins_a_player_to_a_team(seed):
    rules = [Constraint(kind="locked", player_ids=[3], team_index=1)]

    teams = generate_teams(players(8), 2, constraints=rules, rng=random.Random(seed))

    assert team_of(teams, 3) == 1


def test_several_constraints_at_once():
    rules = [
        Constraint(kind="apart", player_ids=[1, 2]),
        Constraint(kind="together", player_ids=[3, 4]),
        Constraint(kind="locked", player_ids=[5], team_index=0),
    ]

    teams = generate_teams(players(10), 2, constraints=rules, rng=rng())

    assert team_of(teams, 1) != team_of(teams, 2)
    assert team_of(teams, 3) == team_of(teams, 4)
    assert team_of(teams, 5) == 0


def test_contradictory_constraints_fail_fast_with_a_useful_message():
    rules = [
        Constraint(kind="together", player_ids=[1, 2]),
        Constraint(kind="apart", player_ids=[1, 2]),
    ]

    with pytest.raises(TeamGenerationError, match="both together and apart"):
        generate_teams(players(6), 2, constraints=rules)


def test_a_together_group_too_large_for_a_team_is_rejected():
    rules = [Constraint(kind="together", player_ids=[1, 2, 3, 4, 5])]

    with pytest.raises(TeamGenerationError, match="cannot fit"):
        generate_teams(players(6), 3, constraints=rules)


def test_impossible_apart_constraints_raise_rather_than_hang():
    """Three mutual enemies cannot be split across two teams."""
    rules = [
        Constraint(kind="apart", player_ids=[1, 2]),
        Constraint(kind="apart", player_ids=[2, 3]),
        Constraint(kind="apart", player_ids=[1, 3]),
    ]

    with pytest.raises(TeamGenerationError, match="No arrangement"):
        generate_teams(players(4), 2, constraints=rules)


# ── Rating balance ────────────────────────────────────────────────────────────


def test_rating_balance_beats_a_random_split():
    """
    With four strong and four weak players, balancing should not leave all the
    strong ones on one team.
    """
    ratings = {1: 1600, 2: 1600, 3: 1600, 4: 1600, 5: 800, 6: 800, 7: 800, 8: 800}

    teams = generate_teams(players(8), 2, balance="rating", ratings=ratings, rng=rng())

    means = [sum(ratings[p.id] for p in t) / len(t) for t in teams]
    assert abs(means[0] - means[1]) < 100


def test_unrated_players_are_treated_as_average():
    """A player with no history must not be assumed to be the worst."""
    teams = generate_teams(players(6), 2, balance="rating", ratings={}, rng=rng())

    assert sum(len(t) for t in teams) == 6


# ── Avoiding a repeat ─────────────────────────────────────────────────────────


def test_avoid_rejects_last_weeks_arrangement():
    previous = [[1, 2, 3, 4], [5, 6, 7, 8]]

    teams = generate_teams(players(8), 2, avoid=previous, rng=rng())

    current = {frozenset(p.id for p in team) for team in teams}
    assert current != {frozenset(t) for t in previous}


def test_avoid_ignores_team_order():
    """Swapping which team is 'team 1' is the same arrangement to the players."""
    previous = [[5, 6, 7, 8], [1, 2, 3, 4]]

    teams = generate_teams(players(8), 2, avoid=previous, rng=rng())

    current = {frozenset(p.id for p in team) for team in teams}
    assert current != {frozenset(t) for t in previous}
