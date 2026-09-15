"""
The captain-draft API: opening a lobby, picking, and turning it into a bracket.

The engine's ordering rules are covered in test_drafting.py without a database.
These tests cover the parts that only exist once a draft is persisted: that a
captain can never be picked, that turns advance in the stored order, that an
undo actually rolls back, and — the point of the whole feature — that finishing
a draft produces a normal tournament every existing format can run.
"""

import pytest
from django.urls import reverse

from apps.tournaments.models import DraftTeam, TeamDraft, Tournament

pytestmark = pytest.mark.django_db


NAMES = ["Ada", "Grace", "Alan", "Katherine", "Linus", "Barbara"]


def create_url():
    return reverse("v1:tournaments:tournament-list")


def draft_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft", args=[tournament_id])


def pick_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft-pick", args=[tournament_id])


def undo_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft-undo", args=[tournament_id])


def complete_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft-complete", args=[tournament_id])


def open_draft(client, *, names=NAMES, team_count=2, captains=None, fmt="single"):
    """Create a tournament in captain-draft mode and return its response body."""
    payload = {
        "format": fmt,
        "title": "Draft night",
        "entrant_labels": names,
        "settings": {
            "team_draft": {
                "team_count": team_count,
                "captain_mode": "manual" if captains else "random",
                **({"captains": captains} if captains else {}),
            }
        },
    }
    response = client.post(create_url(), payload, format="json")
    assert response.status_code == 201, response.json()
    return response.json()


# ── Opening a lobby ───────────────────────────────────────────────────────────


def test_opening_a_draft_creates_no_entrants_yet(auth_client):
    """
    The whole reason for a separate state: entrants are what the bracket is
    built from, and they do not exist until the teams are known.
    """
    body = open_draft(auth_client)

    tournament = Tournament.objects.get(pk=body["id"])
    assert tournament.state == Tournament.State.DRAFTING
    assert tournament.entrants.count() == 0
    assert tournament.matches.count() == 0


def test_captains_are_taken_out_of_the_pool(auth_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])

    draft = auth_client.get(draft_url(body["id"])).json()
    captains = [team["captain_label"] for team in draft["teams"]]

    assert sorted(captains) == ["Ada", "Grace"]
    # The bug this feature most obviously invites: a captain who can also be
    # drafted ends up on two teams.
    assert "Ada" not in draft["pool"]
    assert "Grace" not in draft["pool"]
    assert len(draft["pool"]) == len(NAMES) - 2


def test_random_captains_still_empty_the_pool_of_them(auth_client):
    body = open_draft(auth_client, team_count=3)

    draft = auth_client.get(draft_url(body["id"])).json()
    captains = {team["captain_label"] for team in draft["teams"]}

    assert len(captains) == 3
    assert captains.isdisjoint(set(draft["pool"]))


def test_a_draft_reports_the_sizes_it_will_end_with(auth_client):
    """11 players over 4 teams is 3/3/3/2 — said up front, not discovered."""
    names = [f"P{i}" for i in range(1, 16)]
    body = open_draft(auth_client, names=names, team_count=4)

    draft = auth_client.get(draft_url(body["id"])).json()

    # 15 players: 4 captains, 11 left to draft. The 11 split 3/3/3/2, and each
    # team's captain makes it 4/4/4/3 — one team a player short, which is the
    # documented behaviour rather than a failure.
    assert sum(draft["expected_sizes"]) == 15
    assert draft["expected_sizes"] == [4, 4, 4, 3]


# ── Picking ───────────────────────────────────────────────────────────────────


def test_picking_moves_the_player_and_advances_the_turn(auth_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    before = auth_client.get(draft_url(body["id"])).json()

    first = before["current_team"]
    target = before["pool"][0]

    response = auth_client.post(pick_url(body["id"]), {"label": target}, format="json")
    assert response.status_code == 200, response.json()

    after = response.json()
    assert target not in after["pool"]
    assert after["current_team"] != first
    assert target in after["teams"][first]["members"]


def test_every_team_picks_before_anyone_picks_twice(auth_client):
    body = open_draft(auth_client, team_count=3, captains=["Ada", "Grace", "Alan"])

    seen = []
    for _ in range(3):
        state = auth_client.get(draft_url(body["id"])).json()
        seen.append(state["current_team"])
        auth_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert sorted(seen) == [0, 1, 2]


def test_a_player_cannot_be_picked_twice(auth_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    state = auth_client.get(draft_url(body["id"])).json()
    target = state["pool"][0]

    auth_client.post(pick_url(body["id"]), {"label": target}, format="json")
    response = auth_client.post(pick_url(body["id"]), {"label": target}, format="json")

    assert response.status_code == 400


def test_a_captain_cannot_be_picked(auth_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])

    response = auth_client.post(pick_url(body["id"]), {"label": "Ada"}, format="json")

    assert response.status_code == 400


def test_undo_rolls_the_last_pick_back(auth_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    state = auth_client.get(draft_url(body["id"])).json()
    target = state["pool"][0]

    auth_client.post(pick_url(body["id"]), {"label": target}, format="json")
    response = auth_client.post(undo_url(body["id"]), {}, format="json")

    assert response.status_code == 200
    restored = response.json()
    assert target in restored["pool"]
    assert restored["current_team"] == state["current_team"]
    assert restored["picks_made"] == 0


# ── Completing ────────────────────────────────────────────────────────────────


def drain(client, tournament_id):
    """Pick every remaining player, in pool order."""
    while True:
        state = client.get(draft_url(tournament_id)).json()
        if not state["pool"]:
            return state
        client.post(pick_url(tournament_id), {"label": state["pool"][0]}, format="json")


def test_a_finished_draft_becomes_a_normal_bracket(auth_client):
    """
    The payoff: once the teams are known the existing generator runs, and the
    result is indistinguishable from a tournament created with teams typed in.
    """
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    drain(auth_client, body["id"])

    response = auth_client.post(complete_url(body["id"]), {}, format="json")
    assert response.status_code == 200, response.json()

    detail = response.json()
    assert len(detail["entrants"]) == 2
    assert len(detail["matches"]) == 1
    assert detail["state"] == Tournament.State.DRAFT


def test_completing_refuses_while_players_are_left(auth_client):
    """Step 6 says the bracket forms when the pool empties, not before."""
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])

    response = auth_client.post(complete_url(body["id"]), {}, format="json")

    assert response.status_code == 400


def test_the_chosen_format_is_honoured(auth_client):
    """
    Captains is a seeding phase, not a format. A drafted set of teams has to be
    able to feed any bracket the app supports — that is the entire reason the
    draft produces entrants rather than special-casing the generator.
    """
    body = open_draft(
        auth_client, team_count=4, captains=["Ada", "Grace", "Alan", "Katherine"], fmt="rr"
    )
    drain(auth_client, body["id"])

    detail = auth_client.post(complete_url(body["id"]), {}, format="json").json()

    # Round robin over 4 entrants is 6 matches, every pair once.
    assert len(detail["entrants"]) == 4
    assert len(detail["matches"]) == 6


def test_each_team_keeps_its_captain_in_the_bracket(auth_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    drain(auth_client, body["id"])

    detail = auth_client.post(complete_url(body["id"]), {}, format="json").json()
    labels = [entrant["label"] for entrant in detail["entrants"]]

    assert "Ada's team" in labels
    assert "Grace's team" in labels


def test_an_uneven_pool_leaves_one_team_smaller_rather_than_failing(auth_client):
    """11 players, 4 teams. Nobody is dropped and nothing is padded."""
    names = [f"P{i}" for i in range(1, 16)]
    body = open_draft(auth_client, names=names, team_count=4)
    drain(auth_client, body["id"])

    detail = auth_client.post(complete_url(body["id"]), {}, format="json").json()
    sizes = sorted(len(entrant["players"]) for entrant in detail["entrants"])

    # 11 pool players over 4 teams is 3/3/3/2, and each team's captain makes it
    # 4/4/4/3. Only the team picking last in the rotation comes up short, which
    # is why this is one 3 rather than two — the same arithmetic `expected_sizes`
    # reports up front.
    assert len(detail["entrants"]) == 4
    assert sizes == [3, 4, 4, 4]


# ── Permissions ───────────────────────────────────────────────────────────────


def test_a_stranger_cannot_pick_in_someone_elses_draft(auth_client, api_client):
    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    state = auth_client.get(draft_url(body["id"])).json()

    response = api_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert response.status_code in (401, 403, 404)


def test_captains_backed_by_an_account_record_it(auth_client, user, other_user):
    """
    Nothing local reads `captain_user` — the host taps every pick. It is
    recorded now so live drafting can hand that person their own turn later
    without reshaping rows that already exist.
    """
    from apps.groups.models import Player

    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(auth_client, team_count=2, captains=["Ada", "Grace"])
    draft = TeamDraft.objects.get(tournament_id=body["id"])
    grace = DraftTeam.objects.get(draft=draft, captain_label="Grace")

    assert grace.captain_user_id == other_user.id
