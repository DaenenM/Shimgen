"""Elo ratings and head-to-head stats."""

import pytest

from apps.groups.models import Game, GameMode, Group, Player
from apps.tournaments.brackets.advance import report_result
from apps.tournaments.models import Entrant, Rating
from apps.tournaments.ratings import (
    DEFAULT_ELO,
    apply_match_result,
    expected_score,
    head_to_head,
    rate_tournament,
)

from .factories import TournamentFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def mode(db, user):
    group = Group.objects.create(name="Saturday Crew", owner=user)
    game = Game.objects.create(name="Pummel Party", group=group)
    return GameMode.objects.create(game=game, name="Solo", is_team_based=False)


@pytest.fixture
def roster(db, user):
    return [Player.objects.create(owner=user, display_name=f"Player {i}") for i in range(1, 5)]


def entrant_for(tournament, player, label=None):
    entrant = Entrant.objects.create(tournament=tournament, label=label or player.display_name)
    entrant.players.add(player)
    return entrant


# ── The curve ─────────────────────────────────────────────────────────────────


def test_equal_ratings_expect_a_coin_flip():
    assert expected_score(1200, 1200) == pytest.approx(0.5)


def test_a_400_point_gap_is_about_ten_to_one():
    """The property that defines Elo's scale."""
    assert expected_score(1600, 1200) == pytest.approx(10 / 11, abs=0.01)


def test_expectations_sum_to_one():
    assert expected_score(1500, 1300) + expected_score(1300, 1500) == pytest.approx(1.0)


# ── Applying results ──────────────────────────────────────────────────────────


def test_winning_raises_and_losing_lowers(mode, roster):
    tournament = TournamentFactory(mode=mode)
    a = entrant_for(tournament, roster[0])
    b = entrant_for(tournament, roster[1])

    match = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    rating_a = Rating.objects.get(player=roster[0], mode=mode)
    rating_b = Rating.objects.get(player=roster[1], mode=mode)

    assert rating_a.elo > DEFAULT_ELO
    assert rating_b.elo < DEFAULT_ELO
    assert rating_a.wins == 1
    assert rating_b.losses == 1


def test_rating_changes_are_zero_sum_between_equals(mode, roster):
    tournament = TournamentFactory(mode=mode)
    a = entrant_for(tournament, roster[0])
    b = entrant_for(tournament, roster[1])

    match = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    gained = Rating.objects.get(player=roster[0], mode=mode).elo - DEFAULT_ELO
    lost = DEFAULT_ELO - Rating.objects.get(player=roster[1], mode=mode).elo

    assert gained == pytest.approx(lost)


def test_beating_a_stronger_opponent_gains_more(mode, roster):
    """An upset should move the needle further than an expected win."""
    tournament = TournamentFactory(mode=mode)

    Rating.objects.create(player=roster[1], mode=mode, elo=1800, games=20)
    Rating.objects.create(player=roster[0], mode=mode, elo=1200, games=20)
    Rating.objects.create(player=roster[2], mode=mode, elo=1200, games=20)
    Rating.objects.create(player=roster[3], mode=mode, elo=1000, games=20)

    upset_a = entrant_for(tournament, roster[0])
    strong = entrant_for(tournament, roster[1])
    expected_a = entrant_for(tournament, roster[2])
    weak = entrant_for(tournament, roster[3])

    upset = tournament.matches.create(round_no=1, position=0, a=upset_a, b=strong, best_of=1)
    routine = tournament.matches.create(round_no=1, position=1, a=expected_a, b=weak, best_of=1)

    report_result(upset, score_a=1, score_b=0)
    apply_match_result(upset)
    report_result(routine, score_a=1, score_b=0)
    apply_match_result(routine)

    upset_gain = Rating.objects.get(player=roster[0], mode=mode).elo - 1200
    routine_gain = Rating.objects.get(player=roster[2], mode=mode).elo - 1200

    assert upset_gain > routine_gain


def test_provisional_ratings_move_faster(mode, roster):
    """A new player's 1200 is a guess, so early results should move it more."""
    tournament = TournamentFactory(mode=mode)

    Rating.objects.create(player=roster[1], mode=mode, elo=DEFAULT_ELO, games=50)
    settled_b = entrant_for(tournament, roster[1])
    new_a = entrant_for(tournament, roster[0])

    match = tournament.matches.create(round_no=1, position=0, a=new_a, b=settled_b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    new_gain = Rating.objects.get(player=roster[0], mode=mode).elo - DEFAULT_ELO
    settled_loss = DEFAULT_ELO - Rating.objects.get(player=roster[1], mode=mode).elo

    assert new_gain > settled_loss


def test_byes_do_not_affect_ratings(mode, roster):
    """A walkover is not a game and must not credit anyone."""
    tournament = TournamentFactory(mode=mode)
    a = entrant_for(tournament, roster[0])

    match = tournament.matches.create(round_no=1, position=0, a=a, b=None, winner=a, best_of=1)
    apply_match_result(match)

    assert not Rating.objects.filter(player=roster[0], mode=mode).exists()


def test_a_tournament_with_no_mode_is_skipped(roster):
    """A quick-start bracket has no game attached, so there is nothing to rate."""
    tournament = TournamentFactory(mode=None)
    a = entrant_for(tournament, roster[0])
    b = entrant_for(tournament, roster[1])

    match = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    assert Rating.objects.count() == 0


def test_ad_hoc_entrants_with_no_player_are_skipped(mode):
    """Typed-in names with no roster entry have nowhere to attribute a rating."""
    tournament = TournamentFactory(mode=mode)
    a = Entrant.objects.create(tournament=tournament, label="Guest 1")
    b = Entrant.objects.create(tournament=tournament, label="Guest 2")

    match = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    assert Rating.objects.count() == 0


def test_team_results_rate_every_member(mode, roster):
    tournament = TournamentFactory(mode=mode)

    team_a = Entrant.objects.create(tournament=tournament, label="Team A")
    team_a.players.add(roster[0], roster[1])
    team_b = Entrant.objects.create(tournament=tournament, label="Team B")
    team_b.players.add(roster[2], roster[3])

    match = tournament.matches.create(round_no=1, position=0, a=team_a, b=team_b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    assert Rating.objects.filter(mode=mode).count() == 4
    for player in roster[:2]:
        assert Rating.objects.get(player=player, mode=mode).elo > DEFAULT_ELO
    for player in roster[2:]:
        assert Rating.objects.get(player=player, mode=mode).elo < DEFAULT_ELO


def test_ratings_are_scoped_per_mode(mode, roster, user):
    """Being good at Pummel Party says nothing about your ARAM."""
    other = GameMode.objects.create(game=mode.game, name="Teams", is_team_based=True)

    tournament = TournamentFactory(mode=mode)
    a = entrant_for(tournament, roster[0])
    b = entrant_for(tournament, roster[1])

    match = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    report_result(match, score_a=1, score_b=0)
    apply_match_result(match)

    assert Rating.objects.filter(player=roster[0], mode=mode).exists()
    assert not Rating.objects.filter(player=roster[0], mode=other).exists()


def test_rate_tournament_applies_every_match(mode, roster):
    tournament = TournamentFactory(mode=mode)
    a = entrant_for(tournament, roster[0])
    b = entrant_for(tournament, roster[1])
    c = entrant_for(tournament, roster[2])

    first = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    second = tournament.matches.create(round_no=2, position=0, a=a, b=c, best_of=1)
    report_result(first, score_a=1, score_b=0)
    report_result(second, score_a=1, score_b=0)

    rate_tournament(tournament)

    assert Rating.objects.get(player=roster[0], mode=mode).games == 2
    assert Rating.objects.get(player=roster[0], mode=mode).wins == 2


# ── Head to head ──────────────────────────────────────────────────────────────


def test_head_to_head_counts_both_directions(mode, roster):
    """The 'you're 3-11 against Mark' stat (plan §4, NEW 7)."""
    tournament = TournamentFactory(mode=mode)
    a = entrant_for(tournament, roster[0])
    b = entrant_for(tournament, roster[1])

    first = tournament.matches.create(round_no=1, position=0, a=a, b=b, best_of=1)
    report_result(first, score_a=1, score_b=0)

    # Reversed sides — must still count.
    second = tournament.matches.create(round_no=2, position=0, a=b, b=a, best_of=1)
    report_result(second, score_a=1, score_b=0)

    record = head_to_head(roster[0], roster[1])

    assert record == {"wins": 1, "losses": 1, "played": 2}


def test_head_to_head_is_empty_for_players_who_never_met(mode, roster):
    assert head_to_head(roster[0], roster[3]) == {"wins": 0, "losses": 0, "played": 0}
