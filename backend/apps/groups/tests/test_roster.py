"""
Archiving and restoring roster entries.

Archiving is deliberately not deletion — someone's results are part of everyone
else's history — so it has to be reversible. It was not: the archived filter
applied to every action, so the restore endpoint could never find its target and
archiving a name was a one-way door.
"""

import pytest

from apps.groups.models import Player


@pytest.fixture
def player(user):
    return Player.objects.create(owner=user, display_name="Brett")


@pytest.mark.django_db
def test_an_archived_player_can_be_restored(auth_client, player):
    auth_client.post(f"/api/v1/players/{player.id}/archive/")

    response = auth_client.post(f"/api/v1/players/{player.id}/restore/")

    assert response.status_code == 200
    player.refresh_from_db()
    assert not player.archived


@pytest.mark.django_db
def test_archiving_hides_someone_from_the_default_list(auth_client, player):
    auth_client.post(f"/api/v1/players/{player.id}/archive/")

    names = [row["display_name"] for row in auth_client.get("/api/v1/players/").data["results"]]

    assert names == []


@pytest.mark.django_db
def test_archived_players_are_listed_when_asked_for(auth_client, player):
    auth_client.post(f"/api/v1/players/{player.id}/archive/")

    response = auth_client.get("/api/v1/players/?include_archived=true")

    rows = response.data["results"]
    assert [row["display_name"] for row in rows] == ["Brett"]
    assert rows[0]["archived"] is True


@pytest.mark.django_db
def test_a_restored_player_is_back_in_the_default_list(auth_client, player):
    auth_client.post(f"/api/v1/players/{player.id}/archive/")
    auth_client.post(f"/api/v1/players/{player.id}/restore/")

    names = [row["display_name"] for row in auth_client.get("/api/v1/players/").data["results"]]

    assert names == ["Brett"]


@pytest.mark.django_db
def test_an_archived_player_still_belongs_to_its_owner_alone(api_client, player, other_user):
    api_client.force_authenticate(user=other_user)

    response = api_client.post(f"/api/v1/players/{player.id}/restore/")

    assert response.status_code == 404


# ── Deleting someone with an account ──────────────────────────────────────────


@pytest.fixture
def friend_entry(user, other_user):
    """A roster row backed by a real account."""
    from apps.accounts.models import Friendship

    Friendship.objects.create(from_user=user, to_user=other_user, status=Friendship.Status.ACCEPTED)
    return Player.objects.create(owner=user, display_name=other_user.name, user=other_user)


@pytest.mark.django_db
def test_a_linked_roster_entry_cannot_be_deleted(auth_client, friend_entry):
    # Deleting cascades away their rating history, and that history belongs to
    # somebody who is not the one clicking.
    response = auth_client.delete(f"/api/v1/players/{friend_entry.id}/")

    assert response.status_code == 400
    assert Player.objects.filter(pk=friend_entry.id).exists()


@pytest.mark.django_db
def test_your_own_roster_entry_cannot_be_deleted(auth_client, user):
    mine = Player.objects.create(owner=user, display_name=user.name, user=user)

    response = auth_client.delete(f"/api/v1/players/{mine.id}/")

    assert response.status_code == 400
    assert Player.objects.filter(pk=mine.id).exists()


@pytest.mark.django_db
def test_a_linked_entry_can_still_be_archived(auth_client, friend_entry):
    # Archiving is what the control offers instead, so it has to work.
    response = auth_client.post(f"/api/v1/players/{friend_entry.id}/archive/")

    assert response.status_code == 200
    friend_entry.refresh_from_db()
    assert friend_entry.archived is True


@pytest.mark.django_db
def test_a_plain_typed_name_is_still_deletable(auth_client, player):
    # The rule is about accounts, not about the roster in general.
    response = auth_client.delete(f"/api/v1/players/{player.id}/")

    assert response.status_code == 204
    assert not Player.objects.filter(pk=player.id).exists()


@pytest.mark.django_db
def test_the_refusal_says_what_to_do_instead(auth_client, friend_entry):
    response = auth_client.delete(f"/api/v1/players/{friend_entry.id}/")

    assert "rchive" in str(response.json()["error"]).lower()
