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
