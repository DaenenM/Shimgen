"""
Swiss.

The other bug farm from plan §8. The invariant that matters is **no rematches**:
greedy pairing violates it routinely, and a Swiss tournament that pairs the same
two people twice is visibly broken to anyone who plays them.
"""

import pytest

from apps.tournaments.brackets.advance import report_result
from apps.tournaments.brackets.swiss import (
    generate_swiss,
    pair_next_round,
    swiss_round_count,
)
from apps.tournaments.standings import compute_standings

from .factories import TournamentFactory, make_entrants

pytestmark = pytest.mark.django_db

COUNTS = [4, 5, 6, 7, 8, 9, 11, 12, 16]


def build(count, **kwargs):
    tournament = TournamentFactory(format="swiss", **kwargs)
    entrants = make_entrants(tournament, count)
    generate_swiss(tournament, entrants)
    return tournament, entrants


def play_round(tournament, round_no, *, favour_seed=True):
    """Resolve every unplayed match in a round."""
    for match in tournament.matches.filter(round_no=round_no, winner__isnull=True):
        if not (match.a_id and match.b_id):
            continue  # bye, already credited
        a_wins = (match.a.seed < match.b.seed) if favour_seed else (match.a.seed > match.b.seed)
        report_result(
            match,
            score_a=match.wins_needed if a_wins else 0,
            score_b=0 if a_wins else match.wins_needed,
        )


def play_all(tournament):
    """Play every round, pairing as it goes. Returns rounds played."""
    total = swiss_round_count(tournament.entrants.count())

    for round_no in range(1, total + 1):
        if round_no > 1:
            pair_next_round(tournament)
        play_round(tournament, round_no)

    return total


# ── Round count ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("count", "expected"),
    [(2, 1), (3, 2), (4, 2), (5, 3), (8, 3), (9, 4), (16, 4), (17, 5), (32, 5)],
)
def test_round_count_is_ceil_log2(count, expected):
    assert swiss_round_count(count) == expected


# ── Pairing ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("count", COUNTS)
def test_first_round_pairs_top_half_against_bottom_half(count):
    tournament, entrants = build(count)

    first = tournament.matches.filter(round_no=1).order_by("position")
    half = count // 2

    for index, match in enumerate(first[:half]):
        assert match.a_id == entrants[index].id
        assert match.b_id == entrants[half + index].id


@pytest.mark.parametrize("count", COUNTS)
def test_nobody_plays_the_same_opponent_twice(count):
    """The defining Swiss constraint."""
    tournament, _ = build(count)
    play_all(tournament)

    fixtures = [frozenset((m.a_id, m.b_id)) for m in tournament.matches.all() if m.a_id and m.b_id]

    assert len(fixtures) == len(set(fixtures)), "a rematch was scheduled"


@pytest.mark.parametrize("count", COUNTS)
def test_nobody_plays_twice_in_the_same_round(count):
    tournament, _ = build(count)
    play_all(tournament)

    for round_no in set(tournament.matches.values_list("round_no", flat=True)):
        playing = [
            e for m in tournament.matches.filter(round_no=round_no) for e in (m.a_id, m.b_id) if e
        ]
        assert len(playing) == len(set(playing))


@pytest.mark.parametrize("count", COUNTS)
def test_every_entrant_plays_every_round(count):
    """Nobody is eliminated in Swiss — everyone has a fixture or a bye."""
    tournament, entrants = build(count)
    rounds = play_all(tournament)

    for entrant in entrants:
        appearances = tournament.matches.filter(a=entrant).count()
        appearances += tournament.matches.filter(b=entrant).count()
        assert appearances == rounds, f"{entrant} missed a round"


@pytest.mark.parametrize("count", [5, 7, 9, 11])
def test_nobody_gets_two_byes_while_someone_has_none(count):
    tournament, entrants = build(count)
    play_all(tournament)

    byes = {e.id: tournament.matches.filter(a=e, b__isnull=True).count() for e in entrants}

    assert max(byes.values()) - min(byes.values()) <= 1


@pytest.mark.parametrize("count", COUNTS)
def test_pairing_stops_after_the_final_round(count):
    tournament, _ = build(count)
    play_all(tournament)

    assert pair_next_round(tournament) == []


# ── Standings ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("count", COUNTS)
def test_top_seed_finishes_first_when_the_stronger_entrant_always_wins(count):
    tournament, entrants = build(count)
    play_all(tournament)

    table = compute_standings(tournament)
    assert table[0].entrant_id == entrants[0].id


def test_buchholz_rewards_a_harder_schedule():
    """
    Two entrants level on points are separated by their opponents' scores, which
    is the standard Swiss tiebreak.
    """
    tournament, _ = build(8)
    play_all(tournament)

    table = compute_standings(tournament)

    # Everyone's Buchholz is the sum of their opponents' points, so it must be
    # non-zero once results exist and consistent with who they played.
    assert any(row.buchholz > 0 for row in table)

    for row in table:
        expected = sum(other.points for other in table if other.entrant_id in row.opponents)
        assert row.buchholz == expected


def test_pairing_matches_similar_scores_together():
    """
    After round one, winners should meet winners. That is the whole point of
    Swiss — otherwise it is just a random schedule.
    """
    tournament, _ = build(8)
    play_round(tournament, 1)
    pair_next_round(tournament)

    table = {row.entrant_id: row.points for row in compute_standings(tournament)}

    for match in tournament.matches.filter(round_no=2):
        if match.a_id and match.b_id:
            assert table[match.a_id] == table[match.b_id], "mismatched score groups"


def test_fewer_than_two_entrants_is_rejected():
    tournament = TournamentFactory(format="swiss")
    entrants = make_entrants(tournament, 1)

    with pytest.raises(ValueError, match="at least two"):
        generate_swiss(tournament, entrants)
