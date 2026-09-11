"""
Accepting a friend puts them on your saved roster, and keeps their name current.

Retyping a friend's name after adding them is exactly the friction the saved
roster exists to remove (plan §3), so accepting a request seeds both sides.

The name is *stored* rather than derived at read time, because two other things
read that column and would otherwise let duplicates in: the bulk importer
de-duplicates against it, and a tournament resolves a roster entry by it. So it
is re-synced on the only two events that can change it — accepting, and the
friend renaming themselves.
"""

import pytest

from apps.accounts.models import Friendship
from apps.groups.models import Player

ME = "/api/v1/auth/me/"


def accept(client, friendship):
    return client.post(f"/api/v1/auth/friends/{friendship.id}/accept/")


@pytest.mark.django_db
def test_accepting_adds_each_of_them_to_the_others_roster(auth_client, user, other_user):
    # A friendship is mutual, so it seeds both directions rather than only the
    # side that happened to press Accept.
    friendship = Friendship.objects.create(from_user=other_user, to_user=user)

    assert accept(auth_client, friendship).status_code == 200

    mine = Player.objects.get(owner=user, user=other_user)
    theirs = Player.objects.get(owner=other_user, user=user)

    assert mine.display_name == other_user.name
    assert theirs.display_name == user.name


@pytest.mark.django_db
def test_a_friends_rename_follows_into_the_roster(auth_client, user, other_user):
    friendship = Friendship.objects.create(from_user=other_user, to_user=user)
    accept(auth_client, friendship)

    # `other_user` renames themselves.
    from rest_framework.test import APIClient

    theirs = APIClient()
    theirs.force_authenticate(user=other_user)
    response = theirs.patch(ME, {"display_name": "Pig Benis"}, format="json")

    assert response.status_code == 200
    assert Player.objects.get(owner=user, user=other_user).display_name == "Pig Benis"


@pytest.mark.django_db
def test_an_existing_hand_typed_entry_is_adopted_rather_than_duplicated(
    auth_client, user, other_user
):
    # Almost always the same person, typed before the accounts were connected.
    # Adding a second row would leave the roster showing them twice.
    typed = Player.objects.create(owner=user, display_name=other_user.name)

    friendship = Friendship.objects.create(from_user=other_user, to_user=user)
    accept(auth_client, friendship)

    typed.refresh_from_db()
    assert typed.user_id == other_user.id
    assert Player.objects.filter(owner=user, display_name__iexact=other_user.name).count() == 1


@pytest.mark.django_db
def test_accepting_twice_does_not_add_a_second_entry(auth_client, user, other_user):
    friendship = Friendship.objects.create(from_user=other_user, to_user=user)

    accept(auth_client, friendship)
    accept(auth_client, friendship)

    assert Player.objects.filter(owner=user, user=other_user).count() == 1


@pytest.mark.django_db
def test_renaming_does_not_touch_a_strangers_roster(auth_client, user, other_user):
    # `other_user` has this person on their roster by name alone, with no
    # friendship. A name somebody typed by hand belongs to whoever typed it.
    typed = Player.objects.create(owner=other_user, display_name="Shim")

    auth_client.patch(ME, {"display_name": "Renamed"}, format="json")

    typed.refresh_from_db()
    assert typed.display_name == "Shim"


@pytest.mark.django_db
def test_a_pending_request_seeds_nothing(auth_client, user, other_user):
    # Sending a request is not agreement, so nothing lands on either roster
    # until it is accepted.
    Friendship.objects.create(from_user=user, to_user=other_user)

    assert not Player.objects.filter(owner=user, user=other_user).exists()
    assert not Player.objects.filter(owner=other_user, user=user).exists()


@pytest.mark.django_db
def test_the_roster_says_which_entries_are_friends(auth_client, user, other_user):
    # `linked` only means "has an account" — a co-host who claimed a bracket is
    # linked without being a friend, and only a friend's entry follows a rename.
    friendship = Friendship.objects.create(from_user=other_user, to_user=user)
    accept(auth_client, friendship)

    stranger = Player.objects.create(owner=user, display_name="Someone Else")

    rows = {row["display_name"]: row for row in auth_client.get("/api/v1/players/").data["results"]}

    assert rows[other_user.name]["is_friend"] is True
    assert rows[stranger.display_name]["is_friend"] is False
