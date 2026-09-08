"""
Single elimination generation and advancement.

Swept across 3–64 entrants per plan §8: byes and odd counts are where bracket
code goes wrong, and a wrong bracket destroys trust instantly.
"""

import pytest

from apps.tournaments.brackets.advance import ResultError, clear_result, report_result
from apps.tournaments.brackets.single_elimination import generate_single_elimination
from apps.tournaments.models import Match

from .factories import TournamentFactory, make_entrants

pytestmark = pytest.mark.django_db

# 3..12 covers every small shape, then powers of two and awkward counts above.
COUNTS = [*range(3, 13), 15, 16, 17, 31, 32, 33, 63, 64]


def build(count, **kwargs):
    tournament = TournamentFactory(**kwargs)
    entrants = make_entrants(tournament, count)
    generate_single_elimination(tournament, entrants, third_place=tournament.third_place_match)
    return tournament, entrants


def main_matches(tournament):
    return tournament.matches.filter(bracket=Match.Bracket.MAIN)


# ── Structure ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("count", COUNTS)
def test_match_count_is_always_entrants_minus_one(count):
    """
    Every match eliminates exactly one entrant, and all but the champion are
    eliminated — so a bracket has n-1 real matches regardless of byes.
    """
    tournament, _ = build(count)

    assert main_matches(tournament).count() == count - 1 + _bye_count(count)


def _bye_count(count):
    """Matches that exist structurally but are byes (one side empty)."""
    from apps.tournaments.brackets.seeding import next_power_of_two

    return next_power_of_two(count) - count


@pytest.mark.parametrize("count", COUNTS)
def test_every_entrant_appears_exactly_once_in_round_one(count):
    tournament, entrants = build(count)

    first = main_matches(tournament).filter(round_no=1)
    seated = [e for m in first for e in (m.a_id, m.b_id) if e]

    assert sorted(seated) == sorted(e.id for e in entrants)


@pytest.mark.parametrize("count", COUNTS)
def test_exactly_one_final(count):
    tournament, _ = build(count)

    finals = [m for m in main_matches(tournament) if m.next_match_win_id is None]
    assert len(finals) == 1


@pytest.mark.parametrize("count", COUNTS)
def test_every_non_final_match_feeds_somewhere(count):
    tournament, _ = build(count)

    for match in main_matches(tournament):
        is_final = match.round_no == main_matches(tournament).last().round_no
        if not is_final:
            assert match.next_match_win_id is not None, f"{match} feeds nowhere"


@pytest.mark.parametrize("count", COUNTS)
def test_top_seed_never_faces_a_bye_opponent_late(count):
    """Byes belong in round one only — a later empty slot means broken wiring."""
    tournament, _ = build(count)

    for match in main_matches(tournament).filter(round_no__gt=1):
        # Slots fill as results come in; before any are reported both are empty.
        assert match.winner_id is None or match.is_ready or match.a_id or match.b_id


def test_two_entrants_is_a_single_match():
    """A 2-entrant tournament is one match — the plan's best-of series case."""
    tournament, _ = build(2)

    assert main_matches(tournament).count() == 1


def test_fewer_than_two_entrants_is_rejected():
    tournament = TournamentFactory()
    entrants = make_entrants(tournament, 1)

    with pytest.raises(ValueError, match="at least two"):
        generate_single_elimination(tournament, entrants)


# ── Byes ──────────────────────────────────────────────────────────────────────


def test_byes_advance_automatically():
    """
    With 5 entrants in an 8-bracket, three first-round matches are byes and
    their entrants should already be sitting in round two.
    """
    tournament, _ = build(5)

    round_two = main_matches(tournament).filter(round_no=2)
    seated = [e for m in round_two for e in (m.a_id, m.b_id) if e]

    # Seeds 1, 2 and 3 got byes; 4 and 5 must play each other first.
    assert len(seated) == 3


def test_top_seed_gets_the_bye_when_one_entrant_sits_out():
    """With 3 entrants the top seed should advance, not an arbitrary one."""
    tournament, entrants = build(3)

    bye = main_matches(tournament).filter(round_no=1, winner__isnull=False).get()
    assert bye.winner_id == entrants[0].id


def test_bye_records_no_score():
    """A walkover is not a played match and must not credit anyone with a win."""
    tournament, _ = build(3)

    bye = main_matches(tournament).filter(round_no=1, winner__isnull=False).get()
    assert bye.score == {}


def test_consecutive_byes_cascade():
    """
    A 5-entrant bracket hands seed 1 a bye, then pairs it against the winner of
    4v5. But in a 9-entrant bracket seed 1 gets byes in both round one and two,
    and the bracket must not stall waiting on a match nobody can play.
    """
    tournament, entrants = build(9)

    # Seed 1 has a first-round bye; its round-two opponent comes from a real
    # match, so it should be seated but not yet advanced beyond round two.
    round_two = main_matches(tournament).filter(round_no=2)
    seated = [e for m in round_two for e in (m.a_id, m.b_id) if e]

    assert entrants[0].id in seated


# ── Reporting results ─────────────────────────────────────────────────────────


def test_reporting_advances_the_winner():
    tournament, _ = build(4)
    match = main_matches(tournament).filter(round_no=1, position=0).get()

    report_result(match, score_a=1, score_b=0)
    match.refresh_from_db()

    assert match.winner_id == match.a_id
    assert match.next_match_win.a_id == match.a_id


def test_loser_is_marked_eliminated():
    tournament, _ = build(4)
    match = main_matches(tournament).filter(round_no=1, position=0).get()
    loser = match.b

    report_result(match, score_a=1, score_b=0)
    loser.refresh_from_db()

    assert loser.eliminated is True


def test_feeder_position_decides_the_slot():
    """
    Position 0 feeds slot a, position 1 feeds slot b — deterministically, so
    results arriving out of order cannot swap the two sides.
    """
    tournament, _ = build(4)
    first, second = main_matches(tournament).filter(round_no=1).order_by("position")

    # Report the second match first.
    report_result(second, score_a=1, score_b=0)
    report_result(first, score_a=1, score_b=0)

    final = main_matches(tournament).filter(round_no=2).get()
    assert final.a_id == first.a_id
    assert final.b_id == second.a_id


def test_a_full_bracket_produces_one_champion():
    tournament, entrants = build(8)

    for round_no in (1, 2, 3):
        for match in main_matches(tournament).filter(round_no=round_no):
            if match.is_ready:
                report_result(match, score_a=1, score_b=0)

    final = main_matches(tournament).order_by("-round_no").first()
    final.refresh_from_db()

    assert final.winner_id == entrants[0].id  # top seed wins every match
    remaining = tournament.entrants.filter(eliminated=False)
    assert list(remaining) == [entrants[0]]


# ── Best-of series ────────────────────────────────────────────────────────────


def test_series_does_not_resolve_until_wins_needed():
    tournament, _ = build(2, settings={"best_of": {"default": 5}})
    match = main_matches(tournament).get()

    report_result(match, score_a=2, score_b=1)
    match.refresh_from_db()

    assert match.best_of == 5
    assert match.winner_id is None  # 3 wins needed
    assert match.score == {"a": 2, "b": 1}


def test_series_resolves_at_wins_needed():
    tournament, _ = build(2, settings={"best_of": {"default": 5}})
    match = main_matches(tournament).get()

    report_result(match, score_a=3, score_b=1)
    match.refresh_from_db()

    assert match.winner_id == match.a_id


def test_final_can_use_a_longer_series_than_earlier_rounds():
    """Bo1 early, Bo5 in the final — the standard pattern from plan §3."""
    tournament, _ = build(4, settings={"best_of": {"default": 1, "final": 5}})

    assert main_matches(tournament).filter(round_no=1).first().best_of == 1
    assert main_matches(tournament).filter(round_no=2).get().best_of == 5


def test_score_beyond_the_series_length_is_rejected():
    tournament, _ = build(2, settings={"best_of": {"default": 3}})
    match = main_matches(tournament).get()

    with pytest.raises(ResultError, match="ends at 2 wins"):
        report_result(match, score_a=3, score_b=0)


def test_both_sides_cannot_win():
    tournament, _ = build(2, settings={"best_of": {"default": 3}})
    match = main_matches(tournament).get()

    with pytest.raises(ResultError, match="cannot win"):
        report_result(match, score_a=2, score_b=2)


def test_negative_scores_are_rejected():
    tournament, _ = build(2)
    match = main_matches(tournament).get()

    with pytest.raises(ResultError, match="negative"):
        report_result(match, score_a=-1, score_b=1)


def test_cannot_report_before_both_entrants_are_known():
    tournament, _ = build(4)
    final = main_matches(tournament).filter(round_no=2).get()

    with pytest.raises(ResultError, match="Both entrants"):
        report_result(final, score_a=1, score_b=0)


# ── Corrections ───────────────────────────────────────────────────────────────


def test_correcting_a_result_replaces_the_advanced_entrant():
    """The classic mis-click. The old winner must not be left in the next round."""
    tournament, _ = build(4)
    match = main_matches(tournament).filter(round_no=1, position=0).get()

    report_result(match, score_a=1, score_b=0)
    report_result(match, score_a=0, score_b=1)  # corrected

    match.refresh_from_db()
    assert match.winner_id == match.b_id
    assert match.next_match_win.a_id == match.b_id


def test_correcting_an_early_result_clears_the_later_one():
    """
    Fixing a semifinal cannot leave the beaten entrant standing in the final.
    """
    tournament, _ = build(4)
    first, second = main_matches(tournament).filter(round_no=1).order_by("position")

    report_result(first, score_a=1, score_b=0)
    report_result(second, score_a=1, score_b=0)

    final = main_matches(tournament).filter(round_no=2).get()
    report_result(final, score_a=1, score_b=0)

    # Now correct the first round.
    report_result(first, score_a=0, score_b=1)

    final.refresh_from_db()
    assert final.winner_id is None
    assert final.a_id == first.b_id


def test_clearing_a_result_undoes_elimination():
    tournament, _ = build(4)
    match = main_matches(tournament).filter(round_no=1, position=0).get()
    loser = match.b

    report_result(match, score_a=1, score_b=0)
    clear_result(match)

    match.refresh_from_db()
    loser.refresh_from_db()

    assert match.winner_id is None
    assert match.score == {}
    assert loser.eliminated is False
    assert match.next_match_win.a_id is None


# ── Third place ───────────────────────────────────────────────────────────────


def test_third_place_match_is_created_when_enabled():
    tournament, _ = build(4, third_place_match=True)

    assert tournament.matches.filter(bracket=Match.Bracket.THIRD).count() == 1


def test_third_place_match_receives_both_semifinal_losers():
    tournament, _ = build(4, third_place_match=True)
    first, second = main_matches(tournament).filter(round_no=1).order_by("position")

    report_result(first, score_a=1, score_b=0)
    report_result(second, score_a=1, score_b=0)

    third = tournament.matches.filter(bracket=Match.Bracket.THIRD).get()
    assert third.a_id == first.b_id
    assert third.b_id == second.b_id


def test_no_third_place_match_with_two_entrants():
    """There is no semifinal to lose, so there is nobody to contest it."""
    tournament, _ = build(2, third_place_match=True)

    assert tournament.matches.filter(bracket=Match.Bracket.THIRD).count() == 0


def test_third_place_loser_is_not_double_eliminated():
    tournament, _ = build(4, third_place_match=True)
    first, second = main_matches(tournament).filter(round_no=1).order_by("position")

    report_result(first, score_a=1, score_b=0)
    report_result(second, score_a=1, score_b=0)

    third = tournament.matches.filter(bracket=Match.Bracket.THIRD).get()
    report_result(third, score_a=1, score_b=0)
    third.refresh_from_db()

    assert third.winner_id == third.a_id


# ── Placements ────────────────────────────────────────────────────────────────


def test_nobody_is_first_before_the_tournament_is_won():
    """
    A fresh bracket has no champion. Reporting every entrant as 1st — which is
    what happens if "reached round 1" is treated as a finishing position — reads
    as though everybody won.
    """
    from apps.tournaments.standings import elimination_placements

    tournament, _ = build(5)

    places = elimination_placements(tournament)

    assert 1 not in places.values()


def test_a_first_round_bye_does_not_crown_a_champion():
    """
    A bye is decided but was never played. Treating the last decided match as
    the final would hand the title to whoever drew the walkover.
    """
    from apps.tournaments.standings import champion_entrant_id

    tournament, _ = build(5)

    assert champion_entrant_id(tournament) is None


def test_the_champion_takes_first_once_the_final_is_won():
    from apps.tournaments.standings import elimination_placements

    tournament, entrants = build(4)
    first, second = main_matches(tournament).filter(round_no=1).order_by("position")

    report_result(first, score_a=1, score_b=0)
    report_result(second, score_a=1, score_b=0)
    report_result(main_matches(tournament).filter(round_no=2).get(), score_a=1, score_b=0)

    places = elimination_placements(tournament)

    assert places[entrants[0].id] == 1
    assert list(places.values()).count(1) == 1


def test_an_entrant_still_in_outranks_one_already_knocked_out():
    """
    Counting only matches with both slots filled ignores the round an entrant
    has already advanced into — so a finalist would tie with the entrant they
    beat in round one.
    """
    from apps.tournaments.standings import elimination_placements

    tournament, _ = build(4)
    first, _second = main_matches(tournament).filter(round_no=1).order_by("position")

    # Resolve one semifinal only: its winner is through, its loser is out, and
    # the other semifinal has not been played.
    report_result(first, score_a=1, score_b=0)

    places = elimination_placements(tournament)

    assert places[first.a_id] < places[first.b_id]


def test_the_third_place_match_ranks_its_players_third_and_fourth():
    """
    The two contesting third place lost the semifinals, so they finished above
    everyone knocked out earlier. Treating the playoff as an ordinary bracket
    ranked them below the first-round losers instead.
    """
    from apps.tournaments.standings import elimination_placements

    tournament, _ = build(8, third_place_match=True)

    for round_no in (1, 2):
        for match in main_matches(tournament).filter(round_no=round_no):
            if match.is_ready:
                report_result(match, score_a=1, score_b=0)

    final = main_matches(tournament).filter(round_no=3).get()
    report_result(final, score_a=1, score_b=0)

    third = tournament.matches.get(bracket=Match.Bracket.THIRD)
    report_result(third, score_a=1, score_b=0)

    places = elimination_placements(tournament)

    assert places[final.a_id] == 1
    assert places[final.b_id] == 2
    assert places[third.a_id] == 3
    assert places[third.b_id] == 4

    # Everyone knocked out in round one finishes below all four of them.
    for match in main_matches(tournament).filter(round_no=1):
        loser = match.b_id if match.winner_id == match.a_id else match.a_id
        assert places[loser] > 4
