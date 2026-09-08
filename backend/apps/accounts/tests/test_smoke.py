"""
Smoke tests for the project scaffolding.

These assert that the wiring holds together — settings load, the custom user
model is in force, the error envelope is applied, and the auth routes resolve.
They are deliberately shallow; the deep tests belong with the bracket generators.
"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_custom_user_model_is_active():
    """AUTH_USER_MODEL must be ours — this is unfixable after the first migration."""
    assert get_user_model()._meta.label == "accounts.User"


def test_user_display_name_falls_back_to_username(user):
    assert user.name == "daenen"

    user.display_name = "Shim"
    assert user.name == "Shim"


def test_health_endpoint_reports_database(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_token_endpoint_issues_a_pair(api_client, user):
    response = api_client.post(
        reverse("v1:accounts:token-obtain"),
        {"email": user.email, "password": "test-password-123"},
        format="json",
    )

    assert response.status_code == 200
    assert {"access", "refresh"} <= set(response.json())


def test_errors_use_the_shared_envelope(api_client):
    """Every API error must arrive in the shape the React client parses."""
    response = api_client.post(
        reverse("v1:accounts:token-obtain"),
        {"email": "nobody@example.com", "password": "wrong"},
        format="json",
    )

    assert response.status_code == 401
    body = response.json()
    assert set(body["error"]) == {"code", "message", "details"}


def test_openapi_schema_generates(client, admin_user):
    """A schema that fails to build breaks the frontend's generated API contract."""
    client.force_login(admin_user)
    response = client.get("/api/schema/")

    assert response.status_code == 200
