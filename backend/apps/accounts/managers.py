"""
User manager for email-based login.

Django's stock UserManager is written around USERNAME_FIELD == "username": its
create_user signature is (username, email, password), and it normalises the
username rather than the email. With email as the login field that mismatch
breaks createsuperuser and any caller using keyword arguments.

This manager takes email as the identifier, normalises it, and derives a
username when one is not supplied — `username` is still unique and still used as
the public handle, so it cannot simply be left blank.
"""

import re

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import UserManager as BaseUserManager


class UserManager(BaseUserManager):
    """Creates users keyed on email rather than username."""

    use_in_migrations = True

    def _create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")

        email = self.normalize_email(email)

        # A username is still needed: it is unique and is the public handle. Fall
        # back to the local part of the email, de-duplicated, so createsuperuser
        # and programmatic creation both work without supplying one.
        if not extra_fields.get("username"):
            extra_fields["username"] = self._unique_username(email.split("@")[0])

        user = self.model(email=email, **extra_fields)
        user.password = make_password(password)
        user.save(using=self._db)
        return user

    def _unique_username(self, base: str) -> str:
        """
        Return `base`, or base2, base3… if it is already taken.

        The base is scrubbed to the handle charset first. An email local part is
        free to contain dots and plus-addressing — `first.last+games@x.com` — and
        a username is not, so deriving one verbatim produced an account that
        could never be saved once usernames became a validated handle.

        Matched case-insensitively, because that is how the handle's uniqueness
        constraint works. Checking exactly would happily return "Shim" while
        "shim" exists, and the insert would then fail on the constraint instead
        of here.
        """
        cleaned = re.sub(r"[^A-Za-z0-9_]", "", base or "")
        candidate = cleaned or "player"
        stem = candidate
        suffix = 2

        while self.filter(username__iexact=candidate).exists():
            candidate = f"{stem}{suffix}"
            suffix += 1

        return candidate

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)
