"""
Friend requests: seeing them, and answering them.

The graph itself is covered in test_smoke; these cover the two lists a person
actually reads — what is waiting on them, and what they are waiting on.
"""

import pytest

from apps.accounts.models import Friendship


@pytest.mark.django_db
def test_sent_lists_requests_awaiting_an_answer(auth_client, user, other_user):
    # Without this the sender has no evidence the request went anywhere, and
    # the natural response is to send it again.
    Friendship.objects.create(from_user=user, to_user=other_user)

    response = auth_client.get("/api/v1/auth/friends/sent/")

    assert response.status_code == 200
    assert [row["to_user"]["username"] for row in response.data] == [other_user.username]


@pytest.mark.django_db
def test_sent_excludes_requests_already_accepted(auth_client, user, other_user):
    Friendship.objects.create(from_user=user, to_user=other_user, status=Friendship.Status.ACCEPTED)

    assert auth_client.get("/api/v1/auth/friends/sent/").data == []


@pytest.mark.django_db
def test_sent_excludes_incoming_requests(auth_client, user, other_user):
    # Those belong in `pending`, where they can be accepted.
    Friendship.objects.create(from_user=other_user, to_user=user)

    assert auth_client.get("/api/v1/auth/friends/sent/").data == []
    assert len(auth_client.get("/api/v1/auth/friends/pending/").data) == 1
