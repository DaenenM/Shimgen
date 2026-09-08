"""
Google sign-in.

Google's verification is mocked throughout: these tests are about what this
codebase does with a set of claims, not about whether google-auth validates a
signature correctly. The cases that matter are the ones where a mistake hands
someone an account that is not theirs.
"""

from unittest.mock import patch

import pytest
from django.urls import reverse

from apps.accounts.google import GoogleAuthError, get_or_create_user, verify_token
from apps.accounts.models import User

pytestmark = pytest.mark.django_db

CLAIMS = {
    "sub": "google-subject-123",
    "email": "daenen@example.com",
    "email_verified": True,
    "name": "Daenen",
    "picture": "https://lh3.googleusercontent.com/a/photo",
    "iss": "https://accounts.google.com",
}


def google_url():
    return reverse("v1:accounts:google")


# ── Verification ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("client_id", ["", None])
def test_sign_in_is_refused_when_not_configured(settings, client_id):
    """An unconfigured server must refuse rather than accept anything."""
    settings.GOOGLE_CLIENT_ID = client_id or ""

    with pytest.raises(GoogleAuthError, match="not configured"):
        verify_token("any-token")


def test_empty_credential_is_refused(settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with pytest.raises(GoogleAuthError, match="No Google credential"):
        verify_token("")


def test_a_token_google_rejects_is_refused(settings):
    """Covers a bad signature, a wrong audience and an expired token alike."""
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch(
        "apps.accounts.google.google_id_token.verify_oauth2_token",
        side_effect=ValueError("Token has wrong audience"),
    ):
        with pytest.raises(GoogleAuthError, match="could not be verified"):
            verify_token("forged-token")


def test_an_unverified_email_is_refused(settings):
    """
    The important one. Trusting an unverified address would let someone claim
    an address they do not control and take over the matching local account.
    """
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch(
        "apps.accounts.google.google_id_token.verify_oauth2_token",
        return_value={**CLAIMS, "email_verified": False},
    ):
        with pytest.raises(GoogleAuthError, match="verified email"):
            verify_token("token")


def test_a_wrong_issuer_is_refused(settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch(
        "apps.accounts.google.google_id_token.verify_oauth2_token",
        return_value={**CLAIMS, "iss": "https://evil.example.com"},
    ):
        with pytest.raises(GoogleAuthError, match="could not be verified"):
            verify_token("token")


def test_the_audience_is_actually_checked(settings):
    """
    verify_oauth2_token must receive the client id. Without that argument it
    accepts any valid Google token, from any application — which is the
    difference between working auth and none at all.
    """
    settings.GOOGLE_CLIENT_ID = "our-client-id"

    with patch(
        "apps.accounts.google.google_id_token.verify_oauth2_token",
        return_value=CLAIMS,
    ) as verify:
        verify_token("token")

    assert verify.call_args.args[2] == "our-client-id"


# ── Account resolution ────────────────────────────────────────────────────────


def test_a_new_google_user_gets_an_account():
    user, created = get_or_create_user(CLAIMS)

    assert created is True
    assert user.email == "daenen@example.com"
    assert user.google_sub == "google-subject-123"
    assert user.display_name == "Daenen"


def test_a_google_account_cannot_be_signed_into_with_a_password():
    """No usable password means the password form can never match this account."""
    user, _ = get_or_create_user(CLAIMS)

    assert user.has_usable_password() is False


def test_signing_in_twice_reuses_the_same_account():
    first, created_first = get_or_create_user(CLAIMS)
    second, created_second = get_or_create_user(CLAIMS)

    assert created_first is True
    assert created_second is False
    assert first.id == second.id
    assert User.objects.count() == 1


def test_a_changed_google_email_still_matches_on_sub():
    """
    `sub` is stable, the address is not. Matching on email alone would create a
    duplicate account the moment somebody renames their Gmail.
    """
    original, _ = get_or_create_user(CLAIMS)

    renamed, created = get_or_create_user({**CLAIMS, "email": "newname@example.com"})

    assert created is False
    assert renamed.id == original.id
    assert User.objects.count() == 1


def test_google_links_to_an_existing_email_account(user):
    """
    Someone who registered with a password and later clicks Continue with
    Google should land in their existing account, not a confusing duplicate.
    """
    linked, created = get_or_create_user({**CLAIMS, "email": user.email})

    assert created is False
    assert linked.id == user.id
    assert linked.google_sub == "google-subject-123"


def test_a_chosen_display_name_is_not_overwritten(user):
    """Reverting to their Google name on every sign-in would be maddening."""
    user.display_name = "Pig Benis"
    user.save(update_fields=["display_name"])

    linked, _ = get_or_create_user({**CLAIMS, "email": user.email})

    assert linked.display_name == "Pig Benis"


def test_a_blank_display_name_is_filled_from_google(user):
    user.display_name = ""
    user.save(update_fields=["display_name"])

    linked, _ = get_or_create_user({**CLAIMS, "email": user.email})

    assert linked.display_name == "Daenen"


def test_the_avatar_url_follows_google():
    user, _ = get_or_create_user(CLAIMS)
    updated, _ = get_or_create_user({**CLAIMS, "picture": "https://example.com/new.jpg"})

    assert updated.avatar_url == "https://example.com/new.jpg"
    assert updated.id == user.id


# ── The endpoint ──────────────────────────────────────────────────────────────


def test_the_endpoint_returns_our_own_token_pair(api_client, settings):
    """
    The Google token is traded for shim.gg tokens and discarded, so everything
    downstream sees one kind of credential.
    """
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch("apps.accounts.google.google_id_token.verify_oauth2_token", return_value=CLAIMS):
        response = api_client.post(google_url(), {"credential": "token"}, format="json")

    assert response.status_code == 201
    body = response.json()
    assert {"access", "refresh", "user", "created"} <= set(body)
    assert body["created"] is True
    assert body["user"]["email"] == "daenen@example.com"


def test_the_returned_token_actually_authenticates(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch("apps.accounts.google.google_id_token.verify_oauth2_token", return_value=CLAIMS):
        access = api_client.post(google_url(), {"credential": "token"}, format="json").json()[
            "access"
        ]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = api_client.get(reverse("v1:accounts:me"))

    assert response.status_code == 200
    assert response.json()["email"] == "daenen@example.com"


def test_a_returning_user_reports_created_false(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch("apps.accounts.google.google_id_token.verify_oauth2_token", return_value=CLAIMS):
        api_client.post(google_url(), {"credential": "token"}, format="json")
        response = api_client.post(google_url(), {"credential": "token"}, format="json")

    assert response.status_code == 200
    assert response.json()["created"] is False


def test_a_rejected_token_returns_the_error_envelope(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    with patch(
        "apps.accounts.google.google_id_token.verify_oauth2_token",
        side_effect=ValueError("bad token"),
    ):
        response = api_client.post(google_url(), {"credential": "bad"}, format="json")

    assert response.status_code == 401
    assert set(response.json()["error"]) == {"code", "message", "details"}


def test_a_disabled_account_cannot_sign_in_through_google(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"
    User.objects.create_user(email=CLAIMS["email"], password="x", is_active=False)

    with patch("apps.accounts.google.google_id_token.verify_oauth2_token", return_value=CLAIMS):
        response = api_client.post(google_url(), {"credential": "token"}, format="json")

    assert response.status_code == 403


# ── Config endpoint ───────────────────────────────────────────────────────────


def test_config_reports_google_disabled_when_unconfigured(api_client, settings):
    settings.GOOGLE_CLIENT_ID = ""

    body = api_client.get(reverse("v1:accounts:config")).json()

    assert body["google"]["enabled"] is False


def test_config_reports_google_enabled_with_a_client_id(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client-id"

    body = api_client.get(reverse("v1:accounts:config")).json()

    assert body["google"]["enabled"] is True
    assert body["google"]["client_id"] == "test-client-id"
