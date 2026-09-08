"""
Co-hosts: who may be handed the right to report results.

A co-host decides who won, which is the whole of the night's record. That is
not something to grant to whichever account id happened to be posted, so it is
limited to people the host has already linked accounts with.
"""

import pytest

from apps.accounts.models import Friendship
from apps.tournaments.models import Role, Tournament
from apps.tournaments.tests.factories import TournamentFactory


@pytest.fixture
def tournament(user):
    return TournamentFactory(created_by=user, state=Tournament.State.ACTIVE)


def _befriend(a, b):
    return Friendship.objects.create(from_user=a, to_user=b, status=Friendship.Status.ACCEPTED)


@pytest.mark.django_db
def test_a_friend_can_be_made_a_cohost(auth_client, user, other_user, tournament):
    _befriend(user, other_user)

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament.id}/cohosts/", {"user": other_user.id}, format="json"
    )

    assert response.status_code == 201
    assert tournament.roles.filter(user=other_user, role=Role.Kind.COHOST).exists()


@pytest.mark.django_db
def test_the_direction_of_the_friendship_does_not_matter(auth_client, user, other_user, tournament):
    _befriend(other_user, user)

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament.id}/cohosts/", {"user": other_user.id}, format="json"
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_a_stranger_cannot_be_made_a_cohost(auth_client, other_user, tournament):
    response = auth_client.post(
        f"/api/v1/tournaments/{tournament.id}/cohosts/", {"user": other_user.id}, format="json"
    )

    assert response.status_code == 400
    assert not tournament.roles.filter(user=other_user).exists()


@pytest.mark.django_db
def test_a_pending_friend_request_is_not_enough(auth_client, user, other_user, tournament):
    Friendship.objects.create(from_user=user, to_user=other_user)

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament.id}/cohosts/", {"user": other_user.id}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_an_unknown_account_is_refused(auth_client, tournament):
    response = auth_client.post(
        f"/api/v1/tournaments/{tournament.id}/cohosts/", {"user": 999999}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_only_the_host_can_add_a_cohost(
    api_client, user, other_user, tournament, django_user_model
):
    third = django_user_model.objects.create_user(
        username="kumar", email="kumar@example.com", password="test-password-123"
    )
    _befriend(other_user, third)
    api_client.force_authenticate(user=other_user)

    response = api_client.post(
        f"/api/v1/tournaments/{tournament.id}/cohosts/", {"user": third.id}, format="json"
    )

    assert response.status_code in (403, 404)


# ── Added while creating the bracket ─────────────────────────────────────────


@pytest.mark.django_db
def test_cohosts_can_be_named_when_the_tournament_is_created(auth_client, user, other_user):
    # By the time the first match ends nobody wants to be in a settings screen.
    _befriend(user, other_user)

    response = auth_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "cohosts": [other_user.id]},
        format="json",
    )

    assert response.status_code == 201

    created = Tournament.objects.get(pk=response.data["id"])
    assert created.roles.filter(user=other_user, role=Role.Kind.COHOST).exists()


@pytest.mark.django_db
def test_a_non_friend_named_at_creation_is_skipped_not_fatal(auth_client, other_user):
    # Losing the whole bracket because one name in a list was stale would be a
    # poor trade.
    response = auth_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "cohosts": [other_user.id]},
        format="json",
    )

    assert response.status_code == 201

    created = Tournament.objects.get(pk=response.data["id"])
    assert not created.roles.filter(user=other_user, role=Role.Kind.COHOST).exists()


@pytest.mark.django_db
def test_a_cohost_can_report_results(api_client, auth_client, user, other_user):
    _befriend(user, other_user)

    created = auth_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "cohosts": [other_user.id]},
        format="json",
    )
    tournament = Tournament.objects.get(pk=created.data["id"])
    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()

    api_client.force_authenticate(user=other_user)
    response = api_client.post(
        f"/api/v1/matches/{match.id}/report/", {"score_a": 1, "score_b": 0}, format="json"
    )

    assert response.status_code == 200
