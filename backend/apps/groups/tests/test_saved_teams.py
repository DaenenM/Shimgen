"""
Saved teams — squads kept between game nights.

The rules worth pinning are the ones a careless change would quietly break:
a team belongs to its owner alone, its members can only be that owner's roster
entries, and the logo is validated rather than stored blindly. The last two are
permission and payload boundaries, not conveniences.
"""

import pytest
from django.urls import reverse

from apps.groups.models import Player, SavedTeam

pytestmark = pytest.mark.django_db

# A 1x1 transparent PNG — the smallest thing that is genuinely an image.
TINY_PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA"
    "DUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def list_url():
    return reverse("v1:groups:saved-team-list")


def detail_url(team_id):
    return reverse("v1:groups:saved-team-detail", args=[team_id])


def roster_for(user, *names):
    return [Player.objects.create(owner=user, display_name=name) for name in names]


# ── Creating ──────────────────────────────────────────────────────────────────


def test_a_team_is_built_from_the_owners_roster(auth_client, user):
    players = roster_for(user, "Ada", "Grace")

    response = auth_client.post(
        list_url(),
        {"name": "Blue Shells", "member_ids": [p.id for p in players]},
        format="json",
    )

    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["name"] == "Blue Shells"
    assert sorted(m["display_name"] for m in body["members"]) == ["Ada", "Grace"]


def test_a_team_needs_a_name(auth_client, user):
    response = auth_client.post(list_url(), {"name": "   "}, format="json")

    assert response.status_code == 400


def test_a_team_may_start_empty(auth_client, user):
    """Named first, filled in later — the order people actually work in."""
    response = auth_client.post(list_url(), {"name": "Reserves"}, format="json")

    assert response.status_code == 201
    assert response.json()["members"] == []


def test_two_teams_cannot_share_a_name(auth_client, user):
    auth_client.post(list_url(), {"name": "Blue"}, format="json")
    response = auth_client.post(list_url(), {"name": "Blue"}, format="json")

    # Two teams called "Blue" are indistinguishable in the picker they exist to
    # serve.
    #
    # 409 rather than 400: the database constraint is what refuses this, and
    # `config/exceptions.py` normalises an IntegrityError into a Conflict —
    # which is the more honest status for a uniqueness collision than a generic
    # validation failure.
    assert response.status_code == 409


# ── Member scoping ────────────────────────────────────────────────────────────


def test_somebody_elses_roster_entry_cannot_be_added(auth_client, user, other_user):
    """
    The boundary that matters. A roster entry carries an account link, so
    putting a stranger's Player on your team would attach their identity to your
    squad without their involvement.
    """
    theirs = Player.objects.create(owner=other_user, display_name="Not Yours")

    response = auth_client.post(
        list_url(),
        {"name": "Poachers", "member_ids": [theirs.id]},
        format="json",
    )

    assert response.status_code == 400


# ── Logos ─────────────────────────────────────────────────────────────────────


def test_a_logo_is_stored_as_given(auth_client, user):
    response = auth_client.post(
        list_url(), {"name": "Crested", "logo": TINY_PNG}, format="json"
    )

    assert response.status_code == 201
    assert response.json()["logo"] == TINY_PNG


def test_a_logo_that_is_not_an_image_is_refused(auth_client, user):
    response = auth_client.post(
        list_url(), {"name": "Bogus", "logo": "javascript:alert(1)"}, format="json"
    )

    assert response.status_code == 400


def test_an_oversized_logo_is_refused(auth_client, user):
    # Comfortably past the ceiling, so the check is on size rather than shape.
    huge = "data:image/png;base64," + ("A" * (SavedTeam.LOGO_MAX_BYTES + 1))

    response = auth_client.post(list_url(), {"name": "Huge", "logo": huge}, format="json")

    assert response.status_code == 400


def test_a_team_may_have_no_logo(auth_client, user):
    response = auth_client.post(list_url(), {"name": "Plain"}, format="json")

    assert response.status_code == 201
    assert response.json()["logo"] == ""


# ── Editing and ownership ─────────────────────────────────────────────────────


def test_a_team_can_be_renamed_and_re_crewed(auth_client, user):
    players = roster_for(user, "Ada", "Grace", "Alan")
    created = auth_client.post(
        list_url(),
        {"name": "First Draft", "member_ids": [players[0].id]},
        format="json",
    ).json()

    response = auth_client.patch(
        detail_url(created["id"]),
        {"name": "Second Draft", "member_ids": [players[1].id, players[2].id]},
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Second Draft"
    assert sorted(m["display_name"] for m in body["members"]) == ["Alan", "Grace"]


def test_only_your_own_teams_are_listed(auth_client, user, other_user):
    SavedTeam.objects.create(owner=other_user, name="Theirs")
    auth_client.post(list_url(), {"name": "Mine"}, format="json")

    body = auth_client.get(list_url()).json()
    rows = body["results"] if isinstance(body, dict) and "results" in body else body

    assert [t["name"] for t in rows] == ["Mine"]


def test_somebody_elses_team_cannot_be_edited(auth_client, other_user):
    theirs = SavedTeam.objects.create(owner=other_user, name="Theirs")

    response = auth_client.patch(detail_url(theirs.pk), {"name": "Mine now"}, format="json")

    assert response.status_code in (403, 404)


def test_deleting_a_team_leaves_its_members_in_the_roster(auth_client, user):
    players = roster_for(user, "Ada", "Grace")
    created = auth_client.post(
        list_url(),
        {"name": "Temporary", "member_ids": [p.id for p in players]},
        format="json",
    ).json()

    assert auth_client.delete(detail_url(created["id"])).status_code == 204

    # The team is a grouping, not a container: removing it must not take the
    # people with it.
    assert Player.objects.filter(owner=user).count() == 2


def test_an_anonymous_visitor_has_no_teams(api_client):
    response = api_client.get(list_url())

    assert response.status_code in (200, 401, 403)
    if response.status_code == 200:
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        assert rows == []
