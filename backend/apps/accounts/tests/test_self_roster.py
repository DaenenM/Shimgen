"""
You are on your own saved roster.

You are almost always in your own game night, and typing your own name into
every bracket is the friction the roster exists to remove (plan §3). Kept as a
real linked row rather than a rendered shortcut, so adding yourself attaches
your *account* — the event then lands on your own profile exactly as it does
for a friend.
"""

import pytest

from apps.accounts.models import sync_self_roster_entry
from apps.groups.models import Player
from apps.tournaments.models import Participation

ME = "/api/v1/auth/me/"
PLAYERS = "/api/v1/players/"


@pytest.mark.django_db
def test_registering_puts_you_on_your_own_roster(api_client):
    response = api_client.post(
        "/api/v1/auth/register/",
        {"email": "new@example.com", "password": "test-password-123", "display_name": "Shim"},
        format="json",
    )

    assert response.status_code == 201

    entry = Player.objects.get(owner_id=response.data["id"], user_id=response.data["id"])
    assert entry.display_name == "Shim"


@pytest.mark.django_db
def test_your_row_says_it_is_you(auth_client, user):
    sync_self_roster_entry(user)

    rows = {row["display_name"]: row for row in auth_client.get(PLAYERS).data["results"]}
    mine = rows[user.name]

    assert mine["is_self"] is True
    assert mine["linked"] is True


@pytest.mark.django_db
def test_somebody_elses_row_is_not_you(auth_client, user, other_user):
    sync_self_roster_entry(user)
    Player.objects.create(owner=user, display_name=other_user.name, user=other_user)

    rows = {row["display_name"]: row for row in auth_client.get(PLAYERS).data["results"]}

    assert rows[other_user.name]["is_self"] is False


@pytest.mark.django_db
def test_renaming_yourself_updates_your_own_row(auth_client, user):
    sync_self_roster_entry(user)

    response = auth_client.patch(ME, {"display_name": "Pig Benis"}, format="json")

    assert response.status_code == 200
    assert Player.objects.get(owner=user, user=user).display_name == "Pig Benis"


@pytest.mark.django_db
def test_a_hand_typed_row_of_your_own_name_is_adopted(auth_client, user):
    # Typed before this existed. A second row would show you twice.
    typed = Player.objects.create(owner=user, display_name=user.name)

    sync_self_roster_entry(user)

    typed.refresh_from_db()
    assert typed.user_id == user.id
    assert Player.objects.filter(owner=user, display_name__iexact=user.name).count() == 1


@pytest.mark.django_db
def test_syncing_twice_adds_nothing(user):
    sync_self_roster_entry(user)
    sync_self_roster_entry(user)

    assert Player.objects.filter(owner=user, user=user).count() == 1


@pytest.mark.django_db
def test_adding_yourself_to_a_bracket_attaches_your_account(auth_client, user):
    # The reason this is a real row: the event has to reach your profile.
    sync_self_roster_entry(user)

    response = auth_client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_teams": [
                {"label": "A", "members": [user.name]},
                {"label": "B", "members": ["Someone Else"]},
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    assert Participation.objects.filter(
        user=user, entrant__tournament_id=response.data["id"]
    ).exists()
