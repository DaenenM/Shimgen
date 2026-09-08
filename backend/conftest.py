"""
Fixtures available to every test.

pytest collects this file automatically from the rootdir, so nothing imports it.
"""

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client() -> APIClient:
    """An unauthenticated API client — the spectator's view of the world."""
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    """A plain registered account."""
    return django_user_model.objects.create_user(
        username="daenen", email="daenen@example.com", password="test-password-123"
    )


@pytest.fixture
def other_user(db, django_user_model):
    """A second account, for permission tests that need someone else's data."""
    return django_user_model.objects.create_user(
        username="brett", email="brett@example.com", password="test-password-123"
    )


@pytest.fixture
def auth_client(user) -> APIClient:
    """
    An API client authenticated as `user`.

    Deliberately builds its own APIClient rather than authenticating the
    `api_client` fixture. Sharing one instance means a test that requests both
    ends up with an "anonymous" client that is quietly signed in — which would
    make every permission test pass for the wrong reason.

    force_authenticate rather than a real token exchange: these tests exercise
    endpoint behaviour, and going through the JWT flow each time would only
    re-test simplejwt.
    """
    client = APIClient()
    client.force_authenticate(user=user)
    return client
