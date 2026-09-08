"""
Free-for-all.

Lobbies rather than head-to-head matches, so this is the format that stresses
the FFAResult side of the model. Plan §3 calls it the one Pummel Party needs.
"""

import pytest

from apps.tournaments.brackets.ffa import (
    generate_ffa,
    next_ffa_round,
    points_for,
    report_ffa_result,
)
from apps.tournaments.models import FFAResult

from .factories import TournamentFactory, make_entrants

pytestmark = pytest.mark.django_db


def build(count, ffa=None, **kwargs):
    settings = {"ffa": ffa} if ffa else {}
    tournament = TournamentFactory(format="ffa", settings=settings, **kwargs)
    entrants = make_entrants(tournament, count)
    generate_ffa(tournament, entrants)
    return tournament, entrants


def finish(match, order):
    """Report `order` (best first) as the lobby's finishing positions."""
    report_ffa_result(match, {e.id: i + 1 for i, e in enumerate(order)})


# ── Lobby construction ────────────────────────────────────────────────────────


@pytest.mark.parametrize("count", [2, 3, 4, 5, 6, 8, 9, 12, 16])
def test_every_entrant_is_placed_in_exactly_one_lobby(count):
    tournament, entrants = build(count, ffa={"lobby_size": 4})

    seated = list(
        FFAResult.objects.filter(match__tournament=tournament, match__round_no=1).values_list(
            "entrant_id", flat=True
        )
    )

    assert sorted(seated) == sorted(e.id for e in entrants)


def test_lobbies_respect_the_configured_size():
    tournament, _ = build(8, ffa={"lobby_size": 4})

    lobbies = tournament.matches.filter(round_no=1)
    assert lobbies.count() == 2
    assert all(m.ffa_results.count() == 4 for m in lobbies)


def test_a_lone_remainder_is_folded_into_the_previous_lobby():
    """
    9 entrants in lobbies of 4 would leave one person alone, which is a
    walkover, not a game. They join the previous lobby instead.
    """
    tournament, _ = build(9, ffa={"lobby_size": 4})

    sizes = sorted(m.ffa_results.count() for m in tournament.matches.filter(round_no=1))
    assert sizes == [4, 5]
    assert 1 not in sizes


def test_fewer_than_two_entrants_is_rejected():
    tournament = TournamentFactory(format="ffa")
    entrants = make_entrants(tournament, 1)

    with pytest.raises(ValueError, match="at least two"):
        generate_ffa(tournament, entrants)


# ── Scoring ───────────────────────────────────────────────────────────────────


def test_explicit_points_table_is_used():
    config = {"points": [10, 6, 3, 1]}

    assert points_for(config, 1, 4) == 10
    assert points_for(config, 4, 4) == 1


def test_default_points_scale_with_lobby_size():
    """First in a six-player lobby should beat first in a three-player one."""
    assert points_for({}, 1, 6) > points_for({}, 1, 3)
    assert points_for({}, 6, 6) == 0


def test_reporting_assigns_points_by_placement():
    tournament, entrants = build(4, ffa={"lobby_size": 4, "points": [10, 6, 3, 1]})
    match = tournament.matches.get()

    finish(match, entrants)

    results = {r.entrant_id: r for r in match.ffa_results.all()}
    assert results[entrants[0].id].points == 10
    assert results[entrants[3].id].points == 1


def test_the_first_place_finisher_becomes_the_match_winner():
    """So the rest of the system needs no FFA special case."""
    tournament, entrants = build(4, ffa={"lobby_size": 4})
    match = tournament.matches.get()

    finish(match, [entrants[2], entrants[0], entrants[1], entrants[3]])
    match.refresh_from_db()

    assert match.winner_id == entrants[2].id


def test_placements_with_a_gap_are_rejected():
    tournament, entrants = build(3, ffa={"lobby_size": 4})
    match = tournament.matches.get()

    with pytest.raises(ValueError, match=r"1\.\.n"):
        report_ffa_result(match, {entrants[0].id: 1, entrants[1].id: 2, entrants[2].id: 4})


def test_placements_must_cover_the_whole_lobby():
    tournament, entrants = build(4, ffa={"lobby_size": 4})
    match = tournament.matches.get()

    with pytest.raises(ValueError, match="exactly the entrants"):
        report_ffa_result(match, {entrants[0].id: 1, entrants[1].id: 2})


# ── Multiple rounds and advancement ───────────────────────────────────────────


def test_next_round_carries_only_the_advancing_entrants():
    tournament, _ = build(8, ffa={"lobby_size": 4, "rounds": 2, "advance": 2})

    for match in tournament.matches.filter(round_no=1):
        lobby = [r.entrant for r in match.ffa_results.order_by("entrant_id")]
        finish(match, lobby)

    next_ffa_round(tournament)

    survivors = FFAResult.objects.filter(match__tournament=tournament, match__round_no=2).count()

    assert survivors == 4  # top 2 from each of 2 lobbies


def test_everyone_continues_when_advance_is_zero():
    """Points accumulate across rounds instead of eliminating anyone."""
    tournament, _ = build(8, ffa={"lobby_size": 4, "rounds": 2, "advance": 0})

    for match in tournament.matches.filter(round_no=1):
        finish(match, [r.entrant for r in match.ffa_results.order_by("entrant_id")])

    next_ffa_round(tournament)

    playing = FFAResult.objects.filter(match__tournament=tournament, match__round_no=2).count()

    assert playing == 8


def test_no_further_rounds_once_the_configured_count_is_reached():
    tournament, entrants = build(4, ffa={"lobby_size": 4, "rounds": 1})
    finish(tournament.matches.get(), entrants)

    assert next_ffa_round(tournament) == []
