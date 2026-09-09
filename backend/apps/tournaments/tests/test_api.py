"""
API tests.

Focused on the things the frontend depends on and the permission boundaries
that matter: the no-account quick start, the spectator link staying public, and
who is allowed to report a result.
"""

import pytest
from django.urls import reverse

from apps.tournaments.models import Tournament

pytestmark = pytest.mark.django_db


def create_url():
    return reverse("v1:tournaments:tournament-list")


# ── Quick start, no account ───────────────────────────────────────────────────


def test_anonymous_can_build_a_bracket(api_client):
    """
    The no-account quick start (plan §4, NEW 6). Friction at the front is what
    kills tools like this, so this path must not require a signup.
    """
    response = api_client.post(
        create_url(),
        {"format": "single", "title": "Saturday", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert len(body["entrants"]) == 4
    assert len(body["matches"]) == 3  # 4 entrants -> 3 matches
    assert body["public_slug"]


def test_anonymous_bracket_gets_a_claim_token(api_client):
    api_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B"]},
        format="json",
    )

    tournament = Tournament.objects.get()
    assert tournament.claim_token != ""
    assert tournament.created_by_id is None


def test_claiming_attaches_the_bracket_to_an_account(api_client, auth_client, user):
    api_client.post(create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json")
    tournament = Tournament.objects.get()

    response = auth_client.post(
        reverse("v1:tournaments:tournament-claim", args=[tournament.pk]),
        {"token": tournament.claim_token},
        format="json",
    )

    assert response.status_code == 200
    tournament.refresh_from_db()
    assert tournament.created_by_id == user.id
    assert tournament.claim_token == ""


def test_claiming_with_a_wrong_token_is_refused(api_client, auth_client):
    api_client.post(create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json")
    tournament = Tournament.objects.get()

    response = auth_client.post(
        reverse("v1:tournaments:tournament-claim", args=[tournament.pk]),
        {"token": "wrong"},
        format="json",
    )

    assert response.status_code == 403


# ── Spectator link ────────────────────────────────────────────────────────────


def test_spectator_link_works_without_an_account(api_client, auth_client):
    """This is the acquisition channel — it must stay open (plan §4, NEW 2)."""
    created = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    response = api_client.get(reverse("v1:tournaments:spectate", args=[created["public_slug"]]))

    assert response.status_code == 200
    assert len(response.json()["matches"]) == 3


def test_spectator_view_hides_control_and_identity_fields(api_client, auth_client):
    created = auth_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    body = api_client.get(reverse("v1:tournaments:spectate", args=[created["public_slug"]])).json()

    for hidden in ("roles", "can_report", "is_host", "created_by", "settings"):
        assert hidden not in body


def test_spectator_standings_are_public(api_client, auth_client):
    created = auth_client.post(
        create_url(),
        {"format": "rr", "entrant_labels": ["A", "B", "C"]},
        format="json",
    ).json()

    response = api_client.get(
        reverse("v1:tournaments:spectate-standings", args=[created["public_slug"]])
    )

    assert response.status_code == 200
    assert len(response.json()) == 3


# ── Reporting results ─────────────────────────────────────────────────────────


def test_host_can_report_a_result(auth_client):
    created = auth_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()
    match = created["matches"][0]

    response = auth_client.post(
        reverse("v1:tournaments:match-report", args=[match["id"]]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["winner"] == match["a"]


def test_a_stranger_cannot_report_a_result(auth_client, api_client, other_user):
    created = auth_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()
    match = created["matches"][0]

    api_client.force_authenticate(user=other_user)
    response = api_client.post(
        reverse("v1:tournaments:match-report", args=[match["id"]]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    assert response.status_code == 403


def test_an_invalid_score_returns_the_error_envelope(auth_client):
    created = auth_client.post(
        create_url(),
        {
            "format": "single",
            "entrant_labels": ["A", "B"],
            "settings": {"best_of": {"default": 3}},
        },
        format="json",
    ).json()
    match = created["matches"][0]

    response = auth_client.post(
        reverse("v1:tournaments:match-report", args=[match["id"]]),
        {"score_a": 3, "score_b": 0},  # Bo3 ends at 2
        format="json",
    )

    assert response.status_code == 400
    assert set(response.json()["error"]) == {"code", "message", "details"}


def test_clearing_a_result_undoes_it(auth_client):
    created = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()
    match = next(m for m in created["matches"] if m["a"] and m["b"])

    auth_client.post(
        reverse("v1:tournaments:match-report", args=[match["id"]]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )
    response = auth_client.post(
        reverse("v1:tournaments:match-clear", args=[match["id"]]), format="json"
    )

    assert response.status_code == 200
    assert response.json()["winner"] is None


# ── Late joins ────────────────────────────────────────────────────────────────


def test_late_entrant_is_refused_on_an_active_bracket(auth_client):
    """
    Structurally impossible without a rebuild, so it must be refused clearly
    rather than silently regenerating and wiping results (plan §8).
    """
    created = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    auth_client.post(reverse("v1:tournaments:tournament-start", args=[created["id"]]))

    response = auth_client.post(
        reverse("v1:tournaments:tournament-entrants", args=[created["id"]]),
        {"label": "Latecomer"},
        format="json",
    )

    assert response.status_code == 400
    assert "fixed" in response.json()["error"]["message"]


def test_late_entrant_is_accepted_in_swiss(auth_client):
    """Swiss handles late joins naturally — they enter on 0 points."""
    created = auth_client.post(
        create_url(),
        {"format": "swiss", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    auth_client.post(reverse("v1:tournaments:tournament-start", args=[created["id"]]))

    response = auth_client.post(
        reverse("v1:tournaments:tournament-entrants", args=[created["id"]]),
        {"label": "Latecomer"},
        format="json",
    )

    assert response.status_code == 201


def test_late_entrant_is_accepted_while_still_in_draft(auth_client):
    created = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    response = auth_client.post(
        reverse("v1:tournaments:tournament-entrants", args=[created["id"]]),
        {"label": "Fifth"},
        format="json",
    )

    assert response.status_code == 201


# ── Substitutions ─────────────────────────────────────────────────────────────


def test_substitution_keeps_the_bracket_intact(auth_client):
    """Someone rage-quits: the slot persists, the person in it changes."""
    created = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()
    entrant = created["entrants"][0]
    match_count = len(created["matches"])

    response = auth_client.post(
        reverse(
            "v1:tournaments:tournament-substitute",
            args=[created["id"], entrant["id"]],
        ),
        {"label": "Replacement"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["label"] == "Replacement"

    detail = auth_client.get(
        reverse("v1:tournaments:tournament-detail", args=[created["id"]])
    ).json()
    assert len(detail["matches"]) == match_count


# ── Team generator ────────────────────────────────────────────────────────────


def test_team_generator_works_without_an_account(api_client):
    response = api_client.post(
        reverse("v1:tournaments:team-generate"),
        {"names": ["A", "B", "C", "D"], "team_count": 2},
        format="json",
    )

    assert response.status_code == 200
    teams = response.json()["teams"]
    assert len(teams) == 2
    assert sum(len(t) for t in teams) == 4


def test_two_teams_suggests_a_series_rather_than_a_bracket():
    """A bracket for two teams is just ceremony (plan §3)."""
    from rest_framework.test import APIClient

    response = APIClient().post(
        reverse("v1:tournaments:team-generate"),
        {"names": ["A", "B", "C", "D"], "team_count": 2},
        format="json",
    )

    assert response.json()["suggest_series"] is True


def test_team_generator_respects_apart_constraints(api_client):
    response = api_client.post(
        reverse("v1:tournaments:team-generate"),
        {
            "names": ["A", "B", "C", "D"],
            "team_count": 2,
            "constraints": [{"kind": "apart", "player_ids": [-1, -2]}],
        },
        format="json",
    )

    teams = response.json()["teams"]
    locations = {p["id"]: i for i, team in enumerate(teams) for p in team}
    assert locations[-1] != locations[-2]


def test_impossible_constraints_return_a_useful_message(api_client):
    response = api_client.post(
        reverse("v1:tournaments:team-generate"),
        {
            "names": ["A", "B", "C", "D"],
            "team_count": 2,
            "constraints": [
                {"kind": "together", "player_ids": [-1, -2]},
                {"kind": "apart", "player_ids": [-1, -2]},
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "together and apart" in response.json()["error"]["message"]


# ── Formats end to end ────────────────────────────────────────────────────────


@pytest.mark.parametrize("fmt", ["single", "double", "rr", "swiss", "ffa"])
def test_every_format_generates_through_the_api(auth_client, fmt):
    response = auth_client.post(
        create_url(),
        {"format": fmt, "entrant_labels": [f"P{i}" for i in range(1, 9)]},
        format="json",
    )

    assert response.status_code == 201, response.json()
    assert len(response.json()["matches"]) > 0


# ── Reading back an unclaimed bracket ─────────────────────────────────────────


def test_anonymous_can_read_back_the_bracket_it_just_created(api_client):
    """
    The quick-start flow creates a tournament and redirects to it. If the
    creator cannot then read it, the entire front door 404s the moment it
    succeeds (plan §4, NEW 6).
    """
    created = api_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    response = api_client.get(reverse("v1:tournaments:tournament-detail", args=[created["id"]]))

    assert response.status_code == 200
    assert len(response.json()["matches"]) == 3


def test_a_signed_in_user_can_also_open_an_unclaimed_bracket(api_client, auth_client):
    """Building one signed out then signing in to claim it must still work."""
    created = api_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    response = auth_client.get(reverse("v1:tournaments:tournament-detail", args=[created["id"]]))

    assert response.status_code == 200


def test_unclaimed_brackets_stay_out_of_everyone_elses_list(api_client, auth_client):
    """
    Readable by id is not the same as listed. A stranger's quick-start bracket
    must not appear in someone else's tournament list.
    """
    api_client.post(create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json")

    listed = auth_client.get(create_url()).json()
    results = listed.get("results", listed)

    assert results == []


def test_a_claimed_tournament_is_not_readable_by_a_stranger(api_client, auth_client):
    """Once owned, the ownership filter applies again."""
    created = auth_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    response = api_client.get(reverse("v1:tournaments:tournament-detail", args=[created["id"]]))

    assert response.status_code == 404


def test_anonymous_can_report_on_the_bracket_it_created(api_client):
    """
    Creating a bracket you cannot then run is useless. An unclaimed tournament
    has no owner to protect, so whoever holds it may report results.
    """
    created = api_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()
    match = next(m for m in created["matches"] if m["a"] and m["b"])

    response = api_client.post(
        reverse("v1:tournaments:match-report", args=[match["id"]]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["winner"] == match["a"]


def test_an_unclaimed_bracket_reports_can_report_true(api_client):
    """The client hides result controls unless the API says it may report."""
    created = api_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    assert created["can_report"] is True
    assert created["is_host"] is True


def test_claiming_locks_out_everyone_else(api_client, auth_client):
    """Once an account owns it, the anonymous free-for-all ends."""
    created = api_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()
    tournament = Tournament.objects.get(pk=created["id"])

    auth_client.post(
        reverse("v1:tournaments:tournament-claim", args=[tournament.pk]),
        {"token": tournament.claim_token},
        format="json",
    )

    match = next(m for m in created["matches"] if m["a"] and m["b"])
    response = api_client.post(
        reverse("v1:tournaments:match-report", args=[match["id"]]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    # 401 rather than 403: the caller is anonymous, so DRF asks them to
    # authenticate instead of telling them they are forbidden.
    assert response.status_code == 401


# ── Team entrants ─────────────────────────────────────────────────────────────


def test_teams_carry_their_members_into_the_bracket(auth_client, user):
    """
    The bracket's entrant panel exists so nobody has to remember which team
    they are on. That only works if membership survives creation.
    """
    response = auth_client.post(
        create_url(),
        {
            "format": "single",
            "entrant_teams": [
                {"label": "Blue Shells", "members": ["Ann", "Ben"]},
                {"label": "Red Turtles", "members": ["Cal", "Dee"]},
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    entrants = {e["label"]: e for e in response.json()["entrants"]}

    assert sorted(p["display_name"] for p in entrants["Blue Shells"]["players"]) == ["Ann", "Ben"]
    assert sorted(p["display_name"] for p in entrants["Red Turtles"]["players"]) == ["Cal", "Dee"]


def test_team_members_reuse_existing_roster_entries(auth_client, user):
    """
    Sending the same crew to a second bracket must link the people already in
    the roster, not duplicate them — a duplicate splits one person's stats
    across two rows.
    """
    from apps.groups.models import Player

    existing = Player.objects.create(owner=user, display_name="Ann")

    auth_client.post(
        create_url(),
        {
            "format": "single",
            "entrant_teams": [
                {"label": "A", "members": ["ann"]},  # different case on purpose
                {"label": "B", "members": ["Ben"]},
            ],
        },
        format="json",
    )

    assert Player.objects.filter(owner=user, display_name__iexact="ann").count() == 1
    assert Player.objects.get(owner=user, display_name__iexact="ann").id == existing.id


def test_a_team_without_a_name_is_rejected(auth_client):
    response = auth_client.post(
        create_url(),
        {
            "format": "single",
            "entrant_teams": [
                {"label": "", "members": ["Ann"]},
                {"label": "B", "members": ["Ben"]},
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    # Field errors land in `details`; `message` stays the generic summary.
    assert "name" in str(response.json()["error"]["details"]).lower()


def test_a_single_team_is_rejected(auth_client):
    response = auth_client.post(
        create_url(),
        {"format": "single", "entrant_teams": [{"label": "Alone", "members": ["Ann"]}]},
        format="json",
    )

    assert response.status_code == 400


def test_anonymous_teams_keep_their_names_without_members(api_client):
    """
    An anonymous host has no roster to attach players to, so the team is stored
    as a label alone rather than failing.
    """
    response = api_client.post(
        create_url(),
        {
            "format": "single",
            "entrant_teams": [
                {"label": "Blue Shells", "members": ["Ann", "Ben"]},
                {"label": "Red Turtles", "members": ["Cal", "Dee"]},
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    labels = sorted(e["label"] for e in response.json()["entrants"])
    assert labels == ["Blue Shells", "Red Turtles"]


# ── Deleting ──────────────────────────────────────────────────────────────────


def test_the_host_can_delete_their_tournament(auth_client):
    created = auth_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    response = auth_client.delete(reverse("v1:tournaments:tournament-detail", args=[created["id"]]))

    assert response.status_code == 204
    assert not Tournament.objects.filter(pk=created["id"]).exists()


def test_a_stranger_cannot_delete_someone_elses_tournament(auth_client, api_client, other_user):
    created = auth_client.post(
        create_url(), {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    api_client.force_authenticate(user=other_user)
    response = api_client.delete(reverse("v1:tournaments:tournament-detail", args=[created["id"]]))

    assert response.status_code in (403, 404)
    assert Tournament.objects.filter(pk=created["id"]).exists()


def test_deleting_takes_the_matches_with_it(auth_client):
    """Cascade, so a delete leaves no orphaned match rows behind."""
    from apps.tournaments.models import Match

    created = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    auth_client.delete(reverse("v1:tournaments:tournament-detail", args=[created["id"]]))

    assert not Match.objects.filter(tournament_id=created["id"]).exists()


@pytest.mark.django_db
def test_a_finished_tournament_names_its_winner_in_the_list(auth_client, user):
    """The card in the list says who won, so past nights read as a record."""
    created = auth_client.post(
        "/api/v1/tournaments/",
        {"title": "Finished", "format": "single", "entrant_labels": ["Alpha", "Bravo"]},
        format="json",
    )
    tournament = Tournament.objects.get(pk=created.data["id"])
    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    winner = match.a.label

    auth_client.post(
        f"/api/v1/matches/{match.id}/report/", {"score_a": 1, "score_b": 0}, format="json"
    )

    row = next(
        r
        for r in auth_client.get("/api/v1/tournaments/").data["results"]
        if r["title"] == "Finished"
    )
    assert row["state"] == "complete"
    assert row["winner_label"] == winner


@pytest.mark.django_db
def test_an_unfinished_tournament_names_nobody(auth_client):
    # A bracket in progress has a leader, not a winner.
    auth_client.post(
        "/api/v1/tournaments/",
        {"title": "Ongoing", "format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    )

    row = next(
        r
        for r in auth_client.get("/api/v1/tournaments/").data["results"]
        if r["title"] == "Ongoing"
    )
    assert row["winner_label"] is None
