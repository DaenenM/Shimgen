"""
Google sign-in.

The frontend obtains an ID token from Google Identity Services and posts it
here. This module verifies that token and resolves it to a local account.

The verification is the whole security boundary, so it is done with Google's own
library rather than by decoding the JWT by hand. `verify_oauth2_token` checks the
signature against Google's published keys, the issuer, the expiry, and — the part
that is easy to omit and fatal to omit — the audience. Without the audience check
an attacker could present a valid Google token minted for *any* application and
be signed in as that user here.
"""

import logging

from django.conf import settings
from django.db import transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import User

logger = logging.getLogger(__name__)

ISSUERS = ("accounts.google.com", "https://accounts.google.com")


class GoogleAuthError(Exception):
    """The token was missing, malformed, expired or not meant for us."""


def verify_token(token: str) -> dict:
    """
    Validate a Google ID token and return its claims.

    Raises GoogleAuthError with a message safe to show a user.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google sign-in is not configured on this server.")

    if not token:
        raise GoogleAuthError("No Google credential was provided.")

    try:
        claims = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            # The audience check: the token must have been minted for *this*
            # client, not merely be a valid Google token.
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        # Covers a bad signature, a wrong audience, and an expired token. The
        # detail goes to the log, not to the caller — it can describe internals.
        logger.warning("Rejected Google ID token: %s", exc)
        raise GoogleAuthError("That Google sign-in could not be verified.") from exc

    if claims.get("iss") not in ISSUERS:
        raise GoogleAuthError("That Google sign-in could not be verified.")

    # An unverified address must not be trusted: it would let someone claim an
    # address they do not control and take over the matching local account.
    if not claims.get("email_verified"):
        raise GoogleAuthError("This Google account does not have a verified email.")

    if not claims.get("email"):
        raise GoogleAuthError("That Google account did not share an email address.")

    return claims


@transaction.atomic
def get_or_create_user(claims: dict) -> tuple[User, bool]:
    """
    Resolve verified claims to a local account.

    Returns (user, created). Matching runs in two steps:

      1. by `sub`, Google's stable id — survives an email change;
      2. by email, which links Google to an account that already signed up with
         that address rather than creating a confusing duplicate.

    Step 2 is only safe because `verify_token` has already established that
    Google confirmed the address.
    """
    sub = claims["sub"]
    email = claims["email"].lower()

    user = User.objects.filter(google_sub=sub).first()
    if user is not None:
        _refresh_profile(user, claims)
        return user, False

    user = User.objects.filter(email__iexact=email).first()
    if user is not None:
        # Link Google to the existing account.
        user.google_sub = sub
        _refresh_profile(user, claims, save_fields=["google_sub"])
        return user, False

    user = User.objects.create_user(
        email=email,
        # No usable password: this account signs in through Google. Django
        # stores an unusable hash, so the password form can never match it.
        password=None,
        display_name=claims.get("name", "")[:60],
        google_sub=sub,
        avatar_url=claims.get("picture", ""),
    )
    user.set_unusable_password()
    user.save(update_fields=["password"])

    return user, True


def _refresh_profile(user: User, claims: dict, save_fields: list[str] | None = None):
    """
    Keep the picture in step with Google, and fill a blank display name.

    An existing display name is never overwritten: the user may have chosen it
    deliberately here, and having it silently revert to their Google name after
    every sign-in would be maddening.
    """
    fields = list(save_fields or [])

    picture = claims.get("picture", "")
    if picture and user.avatar_url != picture:
        user.avatar_url = picture
        fields.append("avatar_url")

    if not user.display_name and claims.get("name"):
        user.display_name = claims["name"][:60]
        fields.append("display_name")

    if fields:
        user.save(update_fields=fields)
