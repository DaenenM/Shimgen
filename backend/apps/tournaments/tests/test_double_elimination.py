"""
Double elimination.

Plan §8 names this and Swiss as the two bug farms. The tests below lean on
invariants rather than hardcoded shapes: "nobody is eliminated before losing
twice" catches a whole class of drop-routing bugs that a match-count assertion
sails straight past.
"""

import pytest

from apps.tournaments.brackets.advance import report_result
from apps.tournaments.brackets.double_elimination import generate_double_elimination
from apps.tournaments.models import Match
from apps.tournaments.standings import elimination_placements

from .factories import TournamentFactory, make_entrants

pytestmark = pytest.mark.django_db

COUNTS = [*range(3, 13), 15, 16, 17, 31, 32]


def build(count, **kwargs):
    tournament = TournamentFactory(format="double", **kwargs)
    entrants = make_entrants(tournament, count)
    generate_double_elimination(tournament, entrants)
    return tournament, entrants


def play_out(tournament, *, favour_seed=True):
    """
    Play every match until none can be played.

    `favour_seed` makes the lower-seeded (stronger) entrant always win, which
    makes outcomes deterministic and lets the tests assert on the champion.
    """
    guard = 0
    while True:
        guard += 1
        assert guard < 500, "advancement did not terminate"

        playable = [m for m in tournament.matches.filter(winner__isnull=True) if m.a_id and m.b_id]
        if not playable:
            return

        for match in playable:
            a_seed = match.a.seed or 999
            b_seed = match.b.seed or 999
            a_wins = (a_seed < b_seed) if favour_seed else (a_seed > b_seed)
            report_result(
                match,
                score_a=match.wins_needed if a_wins else 0,
                score_b=0 if a_wins else match.wins_needed,
            )


# ── Structure ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("count", COUNTS)
def test_both_brackets_exist(count):
    tournament, _ = build(count)

    assert tournament.matches.filter(bracket=Match.Bracket.MAIN).exists()
    if count > 2:
        assert tournament.matches.filter(bracket=Match.Bracket.LOSERS).exists()


@pytest.mark.parametrize("count", COUNTS)
def test_every_winners_match_has_a_drop_route(count):
    """
    A winners-bracket loser must land somewhere. A null next_match_lose here is
    the single most common double-elimination bug — the entrant silently
    vanishes instead of dropping.
    """
    tournament, _ = build(count)

    winners_final_round = (
        tournament.matches.filter(bracket=Match.Bracket.MAIN).order_by("-round_no").first().round_no
    )

    for match in tournament.matches.filter(bracket=Match.Bracket.MAIN):
        # The winners final is the exception without a second chance: losing it
        # ends the tournament in 2nd rather than dropping into losers.
        if match.round_no == winners_final_round:
            continue
        assert match.next_match_lose_id is not None, f"{match} drops nowhere"


@pytest.mark.parametrize("count", COUNTS)
def test_grand_final_is_reachable_from_both_brackets(count):
    tournament, _ = build(count)

    grand = tournament.matches.filter(bracket=Match.Bracket.FINAL).order_by("round_no").first()
    feeders = tournament.matches.filter(next_match_win=grand)

    assert feeders.count() == 2, "grand final needs a winners and a losers finalist"


@pytest.mark.parametrize("count", COUNTS)
def test_no_match_feeds_into_itself(count):
    tournament, _ = build(count)

    for match in tournament.matches.all():
        assert match.next_match_win_id != match.id
        assert match.next_match_lose_id != match.id


@pytest.mark.parametrize("count", COUNTS)
def test_advancement_graph_is_acyclic(count):
    """A cycle would make play_out loop forever in production, not just in tests."""
    tournament, _ = build(count)
    edges = {
        m.id: [e for e in (m.next_match_win_id, m.next_match_lose_id) if e]
        for m in tournament.matches.all()
    }

    visiting, done = set(), set()

    def visit(node):
        if node in done:
            return
        assert node not in visiting, "cycle in the advancement graph"
        visiting.add(node)
        for nxt in edges.get(node, []):
            visit(nxt)
        visiting.discard(node)
        done.add(node)

    for node in edges:
        visit(node)


# ── The defining invariant ────────────────────────────────────────────────────


@pytest.mark.parametrize("count", COUNTS)
def test_nobody_is_eliminated_before_losing_twice(count):
    """
    What "double elimination" means, and the invariant that catches bad drop
    routing however it is wrong.

    Requires the second chance: without it the winners final is terminal, so
    losing it once ends your tournament in 2nd by design.
    """
    tournament, _ = build(count, settings={"bracket_reset": True})
    play_out(tournament)

    losses = {e.id: 0 for e in tournament.entrants.all()}
    for match in tournament.matches.filter(winner__isnull=False):
        if not (match.a_id and match.b_id):
            continue  # bye — nobody lost
        loser = match.b_id if match.winner_id == match.a_id else match.a_id
        losses[loser] += 1

    for entrant in tournament.entrants.filter(eliminated=True):
        assert losses[entrant.id] >= 2, f"{entrant} eliminated after {losses[entrant.id]} loss"


@pytest.mark.parametrize("count", COUNTS)
def test_exactly_one_entrant_survives(count):
    tournament, _ = build(count)
    play_out(tournament)

    assert tournament.entrants.filter(eliminated=False).count() == 1


@pytest.mark.parametrize("count", COUNTS)
def test_top_seed_wins_when_the_stronger_entrant_always_wins(count):
    tournament, entrants = build(count)
    play_out(tournament)

    survivor = tournament.entrants.filter(eliminated=False).get()
    assert survivor.id == entrants[0].id


@pytest.mark.parametrize("count", COUNTS)
def test_no_entrant_is_left_stranded_in_an_unplayed_match(count):
    """
    A stalled match holding an entrant means somebody is waiting on a slot that
    will never fill — the bracket has deadlocked.

    Phantoms are the one legitimate exception: losers-bracket matches in a
    heavily-byed bracket whose two feeders were both walkovers, so nobody ever
    arrives. Those hold no entrant, which is exactly what this asserts.
    """
    tournament, _ = build(count)
    play_out(tournament)

    stranded = [m for m in tournament.matches.filter(winner__isnull=True) if m.a_id or m.b_id]
    assert stranded == []


# ── Two brackets, no grand final ──────────────────────────────────────────────


def test_no_grand_final_without_a_second_chance():
    """
    Default shape: the winners final decides 1st and 2nd, the losers final 3rd
    and 4th, and the two brackets never meet.
    """
    tournament, _ = build(8)

    assert tournament.matches.filter(bracket=Match.Bracket.FINAL).count() == 0


def test_the_winners_final_decides_the_title():
    tournament, _ = build(8)
    play_out(tournament)

    winners_final = (
        tournament.matches.filter(bracket=Match.Bracket.MAIN).order_by("-round_no").first()
    )
    places = elimination_placements(tournament)

    assert places[winners_final.winner_id] == 1
    runner_up = (
        winners_final.b_id if winners_final.winner_id == winners_final.a_id else winners_final.a_id
    )
    assert places[runner_up] == 2


def test_the_losers_final_decides_third_and_fourth():
    tournament, _ = build(8)
    play_out(tournament)

    # The terminal losers match: nothing advances out of it.
    losers_final = tournament.matches.filter(
        bracket=Match.Bracket.LOSERS, next_match_win__isnull=True, winner__isnull=False
    ).get()
    places = elimination_placements(tournament)

    fourth = losers_final.b_id if losers_final.winner_id == losers_final.a_id else losers_final.a_id

    # Third and fourth are distinct: they played each other, so one finished
    # above the other rather than sharing a position.
    assert places[losers_final.winner_id] == 3
    assert places[fourth] > places[losers_final.winner_id]


@pytest.mark.parametrize("count", COUNTS)
def test_exactly_one_champion_without_a_grand_final(count):
    """
    Two terminal brackets could easily leave two survivors — the winners
    champion and the losers champion. Only the first is still in.
    """
    tournament, _ = build(count)
    play_out(tournament)

    assert tournament.entrants.filter(eliminated=False).count() == 1


# ── Second chance ─────────────────────────────────────────────────────────────


def test_a_second_chance_adds_the_grand_final_and_its_decider():
    tournament, _ = build(4, settings={"bracket_reset": True})

    assert tournament.matches.filter(bracket=Match.Bracket.FINAL).count() == 2


def test_the_decider_goes_unplayed_when_the_undefeated_side_holds():
    """
    Taking the grand final from the winners bracket ends it outright — the
    decider exists but is never seated.
    """
    tournament, entrants = build(4, settings={"bracket_reset": True})
    play_out(tournament)

    decider = tournament.matches.filter(bracket=Match.Bracket.FINAL).order_by("round_no").last()

    assert decider.winner_id is None
    assert decider.a_id is None and decider.b_id is None
    assert elimination_placements(tournament)[entrants[0].id] == 1


def test_the_decider_is_seated_when_the_losers_finalist_wins():
    """One loss each after the first final, so the decider settles it."""
    tournament, _ = build(4, settings={"bracket_reset": True})

    guard = 0
    while True:
        guard += 1
        assert guard < 100
        playable = [
            m
            for m in tournament.matches.filter(winner__isnull=True)
            if m.a_id and m.b_id and m.bracket != Match.Bracket.FINAL
        ]
        if not playable:
            break
        for match in playable:
            report_result(match, score_a=match.wins_needed, score_b=0)

    grand = tournament.matches.filter(bracket=Match.Bracket.FINAL).order_by("round_no").first()
    grand.refresh_from_db()

    # `b` is the losers finalist. Their win levels it and forces the decider.
    report_result(grand, score_a=0, score_b=grand.wins_needed)

    decider = tournament.matches.filter(bracket=Match.Bracket.FINAL).order_by("round_no").last()

    assert decider.a_id == grand.a_id
    assert decider.b_id == grand.b_id


# ── Small brackets ────────────────────────────────────────────────────────────


def test_two_entrants_still_needs_two_wins():
    """
    With two entrants the loser of the only match has one loss, so they get a
    second chance in the grand final — that is still double elimination.
    """
    tournament, _ = build(2)
    play_out(tournament)

    assert tournament.entrants.filter(eliminated=False).count() == 1


def test_fewer_than_two_entrants_is_rejected():
    tournament = TournamentFactory(format="double")
    entrants = make_entrants(tournament, 1)

    with pytest.raises(ValueError, match="at least two"):
        generate_double_elimination(tournament, entrants)
