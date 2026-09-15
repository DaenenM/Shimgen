"""
The captain-draft ordering and setup rules.

Pure functions, so these run without a database. The pick order is exactly the
kind of thing that looks right and is subtly wrong — an off-by-one in the
rotation hands one team an extra pick, which a group notices immediately and
never forgives (plan §8) — so the boundaries are pinned here rather than left to
a manual check.
"""

import random

import pytest

from apps.tournaments.drafting import (
    DraftError,
    assign_captains,
    build_pick_order,
    picks_per_team,
    teams_payload,
)

NAMES = ["Ada", "Grace", "Alan", "Katherine", "Linus", "Barbara", "Edsger", "Donald"]


# ── Captains ──────────────────────────────────────────────────────────────────


def test_captains_are_removed_from_the_pool():
    """
    The bug worth making structurally impossible: a captain who is also pickable
    ends up on two teams.
    """
    captains, pool = assign_captains(NAMES, 2, rng=random.Random(0))

    assert len(captains) == 2
    assert len(pool) == len(NAMES) - 2
    for captain in captains:
        assert captain not in pool


def test_chosen_captains_are_honoured():
    captains, pool = assign_captains(NAMES, 3, chosen=["Grace", "Linus", "Ada"])

    assert captains == ["Grace", "Linus", "Ada"]
    assert "Grace" not in pool and "Linus" not in pool and "Ada" not in pool


def test_chosen_captains_are_matched_case_insensitively():
    # The host types a name rather than clicking it; "grace" is Grace.
    captains, _ = assign_captains(NAMES, 2, chosen=["grace", "ADA"])

    assert captains == ["Grace", "Ada"]


def test_a_captain_cannot_lead_two_teams():
    with pytest.raises(DraftError, match="two teams"):
        assign_captains(NAMES, 2, chosen=["Ada", "Ada"])


def test_a_captain_must_be_in_the_player_list():
    with pytest.raises(DraftError, match="not in the player list"):
        assign_captains(NAMES, 2, chosen=["Ada", "Nobody"])


def test_the_captain_count_must_match_the_team_count():
    with pytest.raises(DraftError, match="exactly 3"):
        assign_captains(NAMES, 3, chosen=["Ada", "Grace"])


def test_duplicate_names_are_refused():
    # Two people called Alex cannot be told apart once one of them is picked.
    with pytest.raises(DraftError, match="share a name"):
        assign_captains(["Alex", "alex", "Grace", "Ada"], 2)


def test_a_draft_needs_enough_players_to_captain_every_team():
    with pytest.raises(DraftError, match="cannot fill"):
        assign_captains(["Ada", "Grace"], 3)


def test_a_draft_needs_at_least_two_teams():
    with pytest.raises(DraftError, match="at least two teams"):
        assign_captains(NAMES, 1)


# ── Pick order ────────────────────────────────────────────────────────────────


def test_every_team_picks_once_before_anyone_picks_twice():
    """The rule as stated: round one goes through every team, then comes back."""
    order = build_pick_order(4, 12, rng=random.Random(1))

    first_cycle = order[:4]
    assert sorted(first_cycle) == [0, 1, 2, 3]
    assert sorted(order[4:8]) == [0, 1, 2, 3]


def test_the_rotation_is_identical_every_cycle():
    # Not a snake: it comes back around to the first team, in the same order.
    order = build_pick_order(3, 9, rng=random.Random(2))

    assert order[0:3] == order[3:6] == order[6:9]


def test_the_starting_order_is_randomised():
    """
    Being listed first should not be an advantage handed out by typing order.
    Two different seeds must be able to produce two different openings.
    """
    seen = {tuple(build_pick_order(4, 4, rng=random.Random(seed))) for seed in range(20)}

    assert len(seen) > 1


def test_the_order_is_exactly_as_long_as_the_pool():
    # One pick per player, no more: a trailing pick with an empty pool is a turn
    # nobody can take.
    assert len(build_pick_order(3, 7, rng=random.Random(3))) == 7
    assert len(build_pick_order(5, 0, rng=random.Random(3))) == 0


def test_an_uneven_pool_runs_out_mid_cycle():
    """11 players across 4 teams is 3/3/3/2 — the documented behaviour."""
    assert picks_per_team(4, 11) == [3, 3, 3, 2]
    assert sum(picks_per_team(4, 11)) == 11


def test_an_even_pool_splits_evenly():
    assert picks_per_team(3, 9) == [3, 3, 3]


def test_the_teams_short_a_player_are_the_ones_picking_last():
    """
    Consistency between the two halves: whoever the rotation cuts off is who
    `picks_per_team` says gets fewer. The count is reported by position in the
    rotation, so the UI can warn before the draft starts.
    """
    counts = picks_per_team(4, 10)

    assert counts == [3, 3, 2, 2]
    assert sum(counts) == 10


# ── Finished shape ────────────────────────────────────────────────────────────


def test_the_payload_matches_what_entrant_creation_expects():
    """
    `_create_team_entrants` takes [{"label", "members"}]. Matching it exactly is
    what lets a drafted tournament use every existing format unchanged.
    """
    payload = teams_payload(
        ["Ada", "Grace"],
        {0: ["Alan", "Linus"], 1: ["Katherine"]},
    )

    assert payload == [
        {"label": "Ada's team", "members": ["Ada", "Alan", "Linus"]},
        {"label": "Grace's team", "members": ["Grace", "Katherine"]},
    ]


def test_the_captain_leads_their_own_team():
    # They are on the team, and first is how the group says it out loud.
    payload = teams_payload(["Ada"], {0: ["Grace"]})

    assert payload[0]["members"][0] == "Ada"


def test_explicit_labels_win_over_the_captain_default():
    payload = teams_payload(["Ada", "Grace"], {0: [], 1: []}, labels=["Blue", "  "])

    # A blank label falls back rather than naming a team "".
    assert payload[0]["label"] == "Blue"
    assert payload[1]["label"] == "Grace's team"


def test_a_team_with_no_picks_still_has_its_captain():
    # The uneven-pool endpoint: a team that never got a pick is not empty, and
    # an empty entrant is a bracket slot nobody can fill.
    payload = teams_payload(["Ada", "Grace"], {0: ["Alan"]})

    assert payload[1]["members"] == ["Grace"]
