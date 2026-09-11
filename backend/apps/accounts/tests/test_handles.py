"""
The username as a public @handle.

Display names are free to collide — two crews can both have a Shim — which is
only workable because something else is unique. That something is the username,
and it is what a friend request is addressed to.

Making it changeable is what forces the rules here: while nobody could edit it,
Django's default validator (which allows `@ . + - _`) and its case-sensitive
`unique=True` were harmless. Once anyone can pick one, a handle containing `@`
can impersonate an email address, and `Shim` alongside `shim` makes a request
ambiguous.
"""

import pytest

from apps.accounts.models import Friendship, User

ME = "/api/v1/auth/me/"
FRIENDS = "/api/v1/auth/friends/"


# ── Changing your own handle ─────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_username_can_be_changed(auth_client, user):
    response = auth_client.patch(ME, {"username": "shimlord"}, format="json")

    assert response.status_code == 200
    assert response.data["username"] == "shimlord"

    user.refresh_from_db()
    assert user.username == "shimlord"


@pytest.mark.django_db
def test_keeping_your_own_username_is_not_a_collision(auth_client, user):
    # Saving the form without touching the field must not report the handle as
    # taken by its own owner.
    response = auth_client.patch(
        ME, {"username": user.username, "display_name": "Shim"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["display_name"] == "Shim"


@pytest.mark.django_db
def test_a_taken_username_is_refused(auth_client, other_user):
    response = auth_client.patch(ME, {"username": other_user.username}, format="json")

    assert response.status_code == 400
    assert "username" in response.data["error"]["details"]


@pytest.mark.django_db
def test_a_taken_username_is_refused_whatever_its_case(auth_client, other_user):
    # The reason the model carries a Lower() constraint as well: `unique=True`
    # is case-sensitive, so without this "Brett" and "brett" could both exist
    # and a request addressed to either would land on whichever was found first.
    response = auth_client.patch(ME, {"username": other_user.username.upper()}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    "bad", ["has space", "with.dot", "looks@like.email", "plus+one", "dash-ed"]
)
def test_a_username_must_look_like_a_handle(auth_client, bad):
    # `looks@like.email` is the one that matters: it is why the charset was
    # narrowed from Django's default at all.
    response = auth_client.patch(ME, {"username": bad}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_display_names_may_collide(auth_client, other_user):
    # The whole point of the handle: the unique thing is the username, so two
    # people answering to "Shim" is fine.
    other_user.display_name = "Shim"
    other_user.save(update_fields=["display_name"])

    response = auth_client.patch(ME, {"display_name": "Shim"}, format="json")

    assert response.status_code == 200
    assert response.data["display_name"] == "Shim"


# ── Addressing a friend request ──────────────────────────────────────────────


@pytest.mark.django_db
def test_a_friend_request_is_addressed_by_username(auth_client, user, other_user):
    response = auth_client.post(FRIENDS, {"identifier": other_user.username}, format="json")

    assert response.status_code == 201
    assert Friendship.objects.filter(from_user=user, to_user=other_user).exists()


@pytest.mark.django_db
def test_a_leading_at_sign_is_accepted(auth_client, user, other_user):
    # People type the handle the way they see it written.
    response = auth_client.post(FRIENDS, {"identifier": f"@{other_user.username}"}, format="json")

    assert response.status_code == 201
    assert Friendship.objects.filter(from_user=user, to_user=other_user).exists()


@pytest.mark.django_db
def test_a_username_matches_whatever_case_it_is_typed_in(auth_client, user, other_user):
    response = auth_client.post(FRIENDS, {"identifier": other_user.username.upper()}, format="json")

    assert response.status_code == 201
    assert Friendship.objects.filter(from_user=user, to_user=other_user).exists()


@pytest.mark.django_db
def test_an_email_no_longer_finds_anybody(auth_client, other_user):
    # Deliberately removed. A handle is the thing you can hand out without
    # handing out an address, and accepting an email here made the friend form
    # a way to confirm whether a given address has an account.
    response = auth_client.post(FRIENDS, {"identifier": other_user.email}, format="json")

    assert response.status_code == 400
    assert not Friendship.objects.exists()


@pytest.mark.django_db
def test_an_unknown_username_says_so(auth_client):
    response = auth_client.post(FRIENDS, {"identifier": "nobody_at_all"}, format="json")

    assert response.status_code == 400
    assert not Friendship.objects.exists()


# ── Handles derived on signup ────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_derived_username_is_scrubbed_to_the_handle_charset():
    # An email local part may hold dots and plus-addressing; a handle may not.
    # Deriving one verbatim produced an account that could never be saved once
    # the username became a validated handle — and this runs on every signup.
    user = User.objects.create_user(email="first.last+games@example.com", password="x")

    assert user.username == "firstlastgames"
    user.full_clean()  # would raise if the derived handle failed validation


@pytest.mark.django_db
def test_a_derived_username_avoids_an_existing_one_case_insensitively(db):
    User.objects.create_user(email="shim@example.com", username="Shim", password="x")

    second = User.objects.create_user(email="shim@other.example.com", password="x")

    # Not "shim", which would collide with "Shim" under the Lower() constraint.
    assert second.username.lower() != "shim"
    second.full_clean()
