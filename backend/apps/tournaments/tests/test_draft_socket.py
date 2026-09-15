"""
The draft lobby's WebSocket.

Driven with `async_to_sync` rather than async test functions: `pytest-asyncio`
is not installed, and adding a dependency to test one consumer is a worse trade
than wrapping the communicator.

What matters here is not that frames arrive — that is Channels' job — but that
the socket answers the *same* access question the REST list answers. A consumer
that leaked a lobby the tournament list hides would be a permission bug wearing
a different protocol, and nothing in the HTTP test suite would catch it.
"""

import pytest
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.urls import reverse

from apps.accounts.models import Friendship
from apps.groups.models import Player
from apps.tournaments.consumers import DraftConsumer

pytestmark = pytest.mark.django_db(transaction=True)


def create_url():
    return reverse("v1:tournaments:tournament-list")


def befriend(a, b):
    Friendship.objects.create(from_user=a, to_user=b, status="accepted")


def open_draft(client, *, names, team_count=2, captains=None):
    payload = {
        "format": "single",
        "title": "Draft night",
        "entrant_labels": names,
        "settings": {
            "team_draft": {
                "team_count": team_count,
                "captain_mode": "manual" if captains else "random",
                **({"captains": captains} if captains else {}),
            }
        },
    }
    response = client.post(create_url(), payload, format="json")
    assert response.status_code == 201, response.json()
    return response.json()


def connect(tournament_id, user=None):
    """
    Open a socket as `user` and return (accepted, first payload or None).

    The scope is populated directly rather than through the JWT middleware: the
    middleware's job is turning a token into a user and it has no bearing on
    what the consumer then decides, so injecting the user tests the consumer
    rather than re-testing simplejwt.
    """
    from django.contrib.auth.models import AnonymousUser

    async def run():
        communicator = WebsocketCommunicator(
            DraftConsumer.as_asgi(), f"/ws/drafts/{tournament_id}/"
        )
        communicator.scope["url_route"] = {"kwargs": {"tournament_id": tournament_id}}
        communicator.scope["user"] = user or AnonymousUser()

        accepted, _ = await communicator.connect()

        payload = None
        if accepted:
            message = await communicator.receive_json_from()
            payload = message.get("draft")

        await communicator.disconnect()
        return accepted, payload

    return async_to_sync(run)()


# ── Who may watch ─────────────────────────────────────────────────────────────


def test_the_host_can_watch_their_own_draft(auth_client, user):
    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    accepted, payload = connect(body["id"], user)

    assert accepted
    # The current state arrives on connect, so a late arrival is not blank until
    # somebody happens to pick.
    assert payload is not None
    assert len(payload["teams"]) == 2


def test_a_friend_in_the_pool_can_watch(auth_client, user, other_user):
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    accepted, payload = connect(body["id"], other_user)

    assert accepted
    assert payload is not None


def test_a_friend_captaining_can_watch(auth_client, user, other_user):
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(
        auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Grace"]
    )

    accepted, _ = connect(body["id"], other_user)

    assert accepted


def test_a_stranger_is_refused(auth_client, other_user):
    """
    The boundary that matters. A socket is not covered by the queryset that
    hides this tournament from the list, so the rule is restated in the
    consumer — and this is what proves the two agree.
    """
    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    accepted, _ = connect(body["id"], other_user)

    assert not accepted


def test_an_anonymous_viewer_is_refused_an_owned_draft(auth_client):
    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    accepted, _ = connect(body["id"])

    assert not accepted


def test_an_unclaimed_draft_is_watchable_anonymously(api_client):
    """
    The no-account path: a quick-start draft has no owner, and whoever holds it
    is its host. Refusing them their own lobby would break the front door.
    """
    body = open_draft(api_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    accepted, payload = connect(body["id"])

    assert accepted
    assert payload is not None


def test_a_tournament_with_no_draft_is_refused(auth_client, user):
    """An ordinary bracket has no lobby to watch."""
    response = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    )
    assert response.status_code == 201

    accepted, _ = connect(response.json()["id"], user)

    assert not accepted


def test_a_missing_tournament_is_refused(user):
    accepted, _ = connect(999_999, user)

    assert not accepted


# ── The bracket socket ────────────────────────────────────────────────────────


def connect_bracket(tournament_id, user=None):
    """Open a bracket socket as `user` and return whether it was accepted."""
    from django.contrib.auth.models import AnonymousUser

    from apps.tournaments.consumers import TournamentConsumer

    async def run():
        communicator = WebsocketCommunicator(
            TournamentConsumer.as_asgi(), f"/ws/tournaments/{tournament_id}/"
        )
        communicator.scope["url_route"] = {"kwargs": {"tournament_id": tournament_id}}
        communicator.scope["user"] = user or AnonymousUser()

        accepted, _ = await communicator.connect()
        await communicator.disconnect()
        return accepted

    return async_to_sync(run)()


def test_a_spectator_may_watch_a_bracket_without_an_account(auth_client):
    """
    Deliberately broader than the draft rule. A bracket is publicly spectatable
    (plan §4, NEW 2) — nine friends open the link and none of them have an
    account — so anyone who can name it may watch it change. What they *see* is
    decided by the serializer on their own refetch, which is the point of
    sending a nudge rather than data.
    """
    response = auth_client.post(
        create_url(),
        {"format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    )
    assert response.status_code == 201

    assert connect_bracket(response.json()["id"])


def test_a_missing_bracket_is_refused():
    assert not connect_bracket(999_999)
