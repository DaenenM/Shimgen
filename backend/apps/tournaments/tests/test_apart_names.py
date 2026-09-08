"""
Keep-apart rules must hold on every roll, not most of them.

These rules were previously sent as the index each name sat at in the list, so
editing the roster re-pointed them: a removed name left an index matching
nobody, and the resulting rule passed vacuously. Two people who must not share
a team then did, intermittently — which is the worst way for this to fail,
because a single roll looks fine.
"""

import pytest
from rest_framework.test import APIClient

NAMES = ["A", "B", "C", "D", "E", "F"]


def _roll(constraints, names=NAMES, rolls=60, team_count=2):
    """Generate repeatedly and return how often A and B shared a team."""
    client = APIClient()
    together = 0

    for _ in range(rolls):
        response = client.post(
            "/api/v1/teams/generate/",
            {"names": names, "team_count": team_count, "constraints": constraints},
            format="json",
        )
        assert response.status_code == 200, response.data

        where = {p["name"]: i for i, team in enumerate(response.data["teams"]) for p in team}
        if where.get("A") == where.get("B"):
            together += 1

    return together


@pytest.mark.django_db
def test_apart_by_name_holds_every_roll():
    rule = [{"kind": "apart", "player_names": ["A", "B"]}]
    assert _roll(rule) == 0


@pytest.mark.django_db
def test_apart_by_name_holds_across_three_teams():
    rule = [{"kind": "apart", "player_names": ["A", "B"]}]
    assert _roll(rule, team_count=3) == 0


@pytest.mark.django_db
def test_apart_by_name_is_case_and_space_insensitive():
    # The name comes back from a pasted list or a saved chip; neither is a
    # reliable source of exact casing.
    rule = [{"kind": "apart", "player_names": [" a ", "B"]}]
    assert _roll(rule) == 0


@pytest.mark.django_db
def test_rule_naming_a_missing_player_is_dropped_not_half_applied():
    # "A must be apart from Z" cannot be honoured once Z is gone. It must not
    # silently become a rule about A alone.
    rule = [{"kind": "apart", "player_names": ["A", "Z"]}]
    client = APIClient()
    response = client.post(
        "/api/v1/teams/generate/",
        {"names": NAMES, "team_count": 2, "constraints": rule},
        format="json",
    )
    assert response.status_code == 200
    assert sum(len(t) for t in response.data["teams"]) == len(NAMES)


@pytest.mark.django_db
def test_together_by_name_holds_every_roll():
    client = APIClient()
    for _ in range(40):
        response = client.post(
            "/api/v1/teams/generate/",
            {
                "names": NAMES,
                "team_count": 2,
                "constraints": [{"kind": "together", "player_names": ["A", "B"]}],
            },
            format="json",
        )
        assert response.status_code == 200
        where = {p["name"]: i for i, team in enumerate(response.data["teams"]) for p in team}
        assert where["A"] == where["B"]


@pytest.mark.django_db
def test_ids_still_work_for_saved_roster_players():
    # Signed-in callers pass real Player ids; that path must keep working.
    rule = [{"kind": "apart", "player_ids": [-1, -2]}]
    assert _roll(rule) == 0


# ── Namesakes ────────────────────────────────────────────────────────────────
#
# Two people going by the same name is ordinary in a friend group, and it was
# the real cause of the intermittent failures: rules were sent as the index of
# the first matching name, so the second Alex was never constrained and landed
# with Bob on roughly half the rolls.

DUPES = ["Alex", "Bob", "Cara", "Dan", "Alex", "Eve"]


def _seats(response):
    """name -> the team indices players with that name occupy."""
    seats = {}
    for index, team in enumerate(response.data["teams"]):
        for player in team:
            seats.setdefault(player["name"], []).append(index)
    return seats


@pytest.mark.django_db
def test_apart_covers_every_player_sharing_the_named_person_s_name():
    client = APIClient()

    for _ in range(60):
        response = client.post(
            "/api/v1/teams/generate/",
            {
                "names": DUPES,
                "team_count": 2,
                "constraints": [{"kind": "apart", "player_names": ["Alex", "Bob"]}],
            },
            format="json",
        )
        assert response.status_code == 200, response.data

        seats = _seats(response)
        assert seats["Bob"][0] not in seats["Alex"]


@pytest.mark.django_db
def test_namesakes_are_not_forced_apart_from_each_other():
    # "Keep Alex and Bob apart" says nothing about the two Alexes, so they must
    # still be free to share a team — or not.
    names = ["Alex", "Bob", "Cara", "Dan", "Alex", "Eve", "Fay", "Gus", "Hal"]
    client = APIClient()
    arrangements = set()

    for _ in range(60):
        response = client.post(
            "/api/v1/teams/generate/",
            {
                "names": names,
                "team_count": 3,
                "constraints": [{"kind": "apart", "player_names": ["Alex", "Bob"]}],
            },
            format="json",
        )
        assert response.status_code == 200, response.data

        seats = _seats(response)
        assert seats["Bob"][0] not in seats["Alex"]
        arrangements.add(len(set(seats["Alex"])) > 1)

    assert arrangements == {True, False}, "the two Alexes should be free to vary"
