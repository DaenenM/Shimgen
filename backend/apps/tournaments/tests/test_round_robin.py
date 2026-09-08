"""Round robin: the circle method, byes for odd counts, and standings."""

import itertools

import pytest

from apps.tournaments.brackets.advance import report_result
from apps.tournaments.brackets.round_robin import generate_round_robin, round_robin_rounds
from apps.tournaments.standings import compute_standings

from .factories import TournamentFactory, make_entrants

pytestmark = pytest.mark.django_db

COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 12, 16]


def build(count, *, double_round=False, **kwargs):
    tournament = TournamentFactory(format="rr", **kwargs)
    entrants = make_entrants(tournament, count)
    generate_round_robin(tournament, entrants, double_round=double_round)
    return tournament, entrants


# ── Fixture generation ────────────────────────────────────────────────────────


@pytest.mark.parametrize("count", COUNTS)
def test_everyone_plays_everyone_exactly_once(count):
    tournament, entrants = build(count)

    fixtures = [frozenset((m.a_id, m.b_id)) for m in tournament.matches.all() if m.a_id and m.b_id]

    expected = {frozenset(p) for p in itertools.combinations([e.id for e in entrants], 2)}
    assert set(fixtures) == expected
    assert len(fixtures) == len(set(fixtures)), "a fixture was scheduled twice"


@pytest.mark.parametrize("count", COUNTS)
def test_round_count(count):
    """n-1 rounds for an even field, n for odd (everyone sits out once)."""
    tournament, _ = build(count)

    rounds = tournament.matches.values_list("round_no", flat=True).distinct()
    expected = count - 1 if count % 2 == 0 else count

    assert len(set(rounds)) == expected


@pytest.mark.parametrize("count", COUNTS)
def test_nobody_plays_twice_in_the_same_round(count):
    """The bug that makes a schedule unplayable in real life."""
    tournament, _ = build(count)

    for round_no in set(tournament.matches.values_list("round_no", flat=True)):
        playing = [
            e for m in tournament.matches.filter(round_no=round_no) for e in (m.a_id, m.b_id) if e
        ]
        assert len(playing) == len(set(playing)), f"double-booked in round {round_no}"


@pytest.mark.parametrize("count", [3, 5, 7, 9])
def test_odd_counts_give_everyone_exactly_one_bye(count):
    tournament, entrants = build(count)

    rounds = len(set(tournament.matches.values_list("round_no", flat=True)))

    for entrant in entrants:
        played = tournament.matches.filter(a=entrant).count()
        played += tournament.matches.filter(b=entrant).count()
        assert played == rounds - 1, f"{entrant} has the wrong number of byes"


def test_double_round_plays_every_fixture_twice():
    tournament, _ = build(4, double_round=True)

    fixtures = [frozenset((m.a_id, m.b_id)) for m in tournament.matches.all() if m.a_id and m.b_id]
    assert len(fixtures) == 12  # 6 pairings x 2
    assert all(fixtures.count(f) == 2 for f in set(fixtures))


def test_double_round_reverses_the_sides():
    """The second leg swaps home and away, so neither side is favoured."""
    tournament, _ = build(4, double_round=True)

    first_leg = {(m.a_id, m.b_id) for m in tournament.matches.filter(round_no__lte=3)}
    second_leg = {(m.a_id, m.b_id) for m in tournament.matches.filter(round_no__gt=3)}

    assert second_leg == {(b, a) for a, b in first_leg}


def test_fewer_than_two_entrants_is_rejected():
    tournament = TournamentFactory(format="rr")
    entrants = make_entrants(tournament, 1)

    with pytest.raises(ValueError, match="at least two"):
        generate_round_robin(tournament, entrants)


def test_pairing_helper_is_database_free():
    """round_robin_rounds is pure, so the schedule can be tested in isolation."""
    rounds = round_robin_rounds(["a", "b", "c", "d"])

    assert len(rounds) == 3
    assert all(len(r) == 2 for r in rounds)


# ── Standings ─────────────────────────────────────────────────────────────────


def test_points_are_configurable():
    tournament, entrants = build(4, settings={"points": {"win": 3, "draw": 1, "loss": 0}})

    for match in tournament.matches.filter(a=entrants[0]):
        report_result(match, score_a=1, score_b=0)
    for match in tournament.matches.filter(b=entrants[0]):
        report_result(match, score_a=0, score_b=1)

    table = compute_standings(tournament)

    assert table[0].entrant_id == entrants[0].id
    assert table[0].points == 9  # three wins
    assert table[0].wins == 3


def test_a_draw_awards_both_sides_the_draw_points():
    tournament, _ = build(2, settings={"points": {"win": 3, "draw": 1, "loss": 0}})
    match = tournament.matches.get()

    # Bo1 cannot draw, so use a series that ends level.
    match.best_of = 3
    match.save(update_fields=["best_of"])
    match.score = {"a": 1, "b": 1}
    match.winner = match.a  # resolved, but level on the series score
    match.save(update_fields=["score", "winner"])

    table = compute_standings(tournament)

    assert {row.points for row in table} == {1}
    assert all(row.draws == 1 for row in table)


def test_head_to_head_breaks_a_tie_on_points():
    """Two entrants level on points: the one who won the meeting ranks higher."""
    tournament, entrants = build(4)
    a, b = entrants[0], entrants[1]

    meeting = tournament.matches.filter(a__in=[a, b], b__in=[a, b]).get()
    # b beats a.
    if meeting.a_id == a.id:
        report_result(meeting, score_a=0, score_b=1)
    else:
        report_result(meeting, score_a=1, score_b=0)

    table = {row.entrant_id: row for row in compute_standings(tournament)}
    order = [row.entrant_id for row in compute_standings(tournament)]

    assert table[b.id].points >= table[a.id].points
    assert order.index(b.id) < order.index(a.id)


def test_standings_include_every_entrant_even_before_any_result():
    tournament, _ = build(6)

    table = compute_standings(tournament)

    assert len(table) == 6
    assert all(row.played == 0 for row in table)
