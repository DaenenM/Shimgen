"""
Who can see a captain draft, and who may take a turn in it.

These cover the two grants added for shared lobbies, and both are permission
boundaries rather than conveniences — the kind of thing that is quietly wrong
until somebody sees a tournament they should not, or takes a pick that was not
theirs.

The shape of the problem: a drafting tournament has *no entrants*, so the
ordinary visibility rule (a linked participation) cannot match it. Visibility
comes instead from the accounts recorded when the draft opened.
"""

import pytest
from django.urls import reverse

from apps.accounts.models import Friendship
from apps.groups.models import Player
from apps.tournaments.models import TeamDraft, Tournament

pytestmark = pytest.mark.django_db


def create_url():
    return reverse("v1:tournaments:tournament-list")


def draft_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft", args=[tournament_id])


def pick_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft-pick", args=[tournament_id])


def undo_url(tournament_id):
    return reverse("v1:tournaments:tournament-draft-undo", args=[tournament_id])


def befriend(a, b):
    """An accepted friendship, which is what a roster link implies socially."""
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


def client_for(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


def visible_ids(client):
    """
    The tournament ids this client can see in its own list.

    Unpacked carefully: an empty page is `{"results": []}`, and `results or body`
    falls through to the dict when the list is empty — then iterating it yields
    the dict's *keys*. Since "sees nothing" is precisely the case these tests
    assert, that shortcut fails exactly where it matters.
    """
    body = client.get(create_url()).json()
    rows = body["results"] if isinstance(body, dict) and "results" in body else body
    return [row["id"] for row in rows]


# ── Visibility ────────────────────────────────────────────────────────────────


def test_a_friend_in_the_pool_sees_the_lobby(auth_client, user, other_user):
    """
    The point of the feature: somebody being drafted can watch it happen from
    their own device. Without this the lobby is invisible to them until the
    bracket exists, because a drafting tournament has no entrants to link to.
    """
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    ids = visible_ids(client_for(other_user))

    assert body["id"] in ids


def test_a_friend_captaining_sees_the_lobby(auth_client, user, other_user):
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(
        auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Grace"]
    )

    ids = visible_ids(client_for(other_user))

    assert body["id"] in ids


def test_a_stranger_does_not_see_the_lobby(auth_client, user, other_user):
    """
    Nobody is in this draft but the host. A tournament appearing in an unrelated
    person's list is the failure worth guarding: the clause is an OR against
    every row in the table.
    """
    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    ids = visible_ids(client_for(other_user))

    assert body["id"] not in ids


def test_an_unlinked_name_grants_nobody_anything(auth_client, user, other_user):
    """
    A roster entry with no account behind it is just a string. It must not be
    matched to whoever happens to share that name.
    """
    Player.objects.create(owner=user, display_name="Grace")  # no `user`

    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    ids = visible_ids(client_for(other_user))

    assert body["id"] not in ids


def test_the_pool_members_recorded_are_only_linked_accounts(auth_client, user, other_user):
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])
    draft = TeamDraft.objects.get(tournament_id=body["id"])

    # Grace is in the pool and linked; Kath is in the pool and is not.
    assert draft.pool_user_ids == [other_user.id]


# ── Picking ───────────────────────────────────────────────────────────────────


def test_a_captain_may_pick_on_their_own_turn(auth_client, user, other_user):
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(
        auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Grace"]
    )
    guest = client_for(other_user)

    state = guest.get(draft_url(body["id"])).json()
    grace = next(t for t in state["teams"] if t["captain_label"] == "Grace")

    # Walk the rotation to Grace's turn, the host taking any earlier picks.
    while state["current_team"] != grace["position"]:
        auth_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")
        state = guest.get(draft_url(body["id"])).json()

    response = guest.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert response.status_code == 200, response.json()


def test_a_captain_cannot_pick_on_somebody_elses_turn(auth_client, user, other_user):
    """
    The guarantee that makes a shared lobby safe: nobody has to trust the room
    to wait their turn, because the server will not let them jump it.
    """
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(
        auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Grace"]
    )
    guest = client_for(other_user)

    state = guest.get(draft_url(body["id"])).json()
    grace = next(t for t in state["teams"] if t["captain_label"] == "Grace")

    # Move the turn away from Grace if it happens to be hers.
    if state["current_team"] == grace["position"]:
        auth_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")
        state = guest.get(draft_url(body["id"])).json()

    assert state["current_team"] != grace["position"]

    response = guest.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert response.status_code in (403, 404)


def test_a_non_captain_friend_cannot_pick_at_all(auth_client, user, other_user):
    """Watching is not picking. Being in the pool grants sight, nothing more."""
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])
    guest = client_for(other_user)

    state = guest.get(draft_url(body["id"])).json()
    response = guest.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert response.status_code in (403, 404)


def test_a_captain_cannot_undo(auth_client, user, other_user):
    """
    Undo rewrites somebody else's pick, so it stays with the host even for a
    captain whose own turn it is.
    """
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(
        auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Grace"]
    )
    guest = client_for(other_user)

    state = guest.get(draft_url(body["id"])).json()
    auth_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    response = guest.post(undo_url(body["id"]), {}, format="json")

    assert response.status_code in (403, 404)


def test_the_host_can_still_pick_for_anyone(auth_client, user, other_user):
    """
    The ordinary case stays intact: one device on a table, the host tapping for
    whoever is up. Adding a captain grant must not take that away.
    """
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(
        auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Grace"]
    )
    state = auth_client.get(draft_url(body["id"])).json()

    response = auth_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert response.status_code == 200, response.json()


def test_an_anonymous_draft_is_still_pickable(api_client):
    """
    The no-account path must keep working: an unclaimed tournament belongs to
    whoever is holding it, and requiring a login to run a draft would make the
    quick start useless.
    """
    body = open_draft(api_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])
    state = api_client.get(draft_url(body["id"])).json()

    response = api_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    assert response.status_code == 200, response.json()


def test_a_drafting_tournament_is_not_visible_once_it_becomes_a_bracket(
    auth_client, user, other_user
):
    """
    The draft grant is scoped to the drafting state. Once the bracket exists the
    ordinary rules take over — and a pool member who never became a linked
    entrant should not keep a view they only had because a draft was running.
    """
    befriend(user, other_user)
    Player.objects.create(owner=user, display_name="Grace", user=other_user)

    body = open_draft(auth_client, names=["Ada", "Grace", "Alan", "Kath"], captains=["Ada", "Alan"])

    while True:
        state = auth_client.get(draft_url(body["id"])).json()
        if not state["pool"]:
            break
        auth_client.post(pick_url(body["id"]), {"label": state["pool"][0]}, format="json")

    auth_client.post(
        reverse("v1:tournaments:tournament-draft-complete", args=[body["id"]]), {}, format="json"
    )

    tournament = Tournament.objects.get(pk=body["id"])
    assert tournament.state == Tournament.State.DRAFT
