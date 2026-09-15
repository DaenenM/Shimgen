"""
Naming a tournament that was created without a title.

The number exists so a host can tell their own untitled nights apart in their
own list. Two properties carry that, and both are easy to get subtly wrong:

  - it is counted **per account**, so strangers' brackets cannot move it, and
  - it follows the **highest number in use**, not the row count, so deleting
    one does not hand its number to the next tournament created.
"""

import pytest
from django.urls import reverse

from apps.tournaments.models import Tournament

pytestmark = pytest.mark.django_db


def create_url():
    return reverse("v1:tournaments:tournament-list")


def make(client, **extra):
    payload = {"format": "single", "entrant_labels": ["A", "B"], **extra}
    response = client.post(create_url(), payload, format="json")
    assert response.status_code == 201, response.json()
    return response.json()


def test_the_first_untitled_tournament_is_numbered_one(auth_client):
    body = make(auth_client)

    assert body["title"] == "Untitled Tournament 1"


def test_each_untitled_tournament_takes_the_next_number(auth_client):
    titles = [make(auth_client)["title"] for _ in range(3)]

    assert titles == [
        "Untitled Tournament 1",
        "Untitled Tournament 2",
        "Untitled Tournament 3",
    ]


def test_a_supplied_title_is_left_alone(auth_client):
    body = make(auth_client, title="Friday Night")

    assert body["title"] == "Friday Night"


def test_a_blank_title_still_gets_numbered(auth_client):
    # An empty string is what the form sends when the field is untouched, and
    # it must be treated as "no title" rather than as a title of "".
    body = make(auth_client, title="   ")

    assert body["title"] == "Untitled Tournament 1"


def test_titled_tournaments_do_not_advance_the_counter(auth_client):
    make(auth_client, title="Friday Night")
    make(auth_client, title="Saturday")

    assert make(auth_client)["title"] == "Untitled Tournament 1"


def test_deleting_one_does_not_reuse_its_number(auth_client):
    """
    The reason this follows the highest number rather than the count. Deleting
    the second of three and counting rows would name the next one 3 as well —
    two tournaments called "Untitled Tournament 3", which is the collision the
    number exists to prevent.
    """
    first = make(auth_client)
    second = make(auth_client)
    make(auth_client)

    Tournament.objects.filter(pk=second["id"]).delete()

    assert make(auth_client)["title"] == "Untitled Tournament 4"
    assert first["title"] == "Untitled Tournament 1"


def test_another_persons_tournaments_do_not_move_your_number(auth_client, other_user):
    """
    Counted per account. A global counter would jump every time a stranger made
    a bracket, so a host's own list would skip numbers for no visible reason.
    """
    from rest_framework.test import APIClient

    theirs = APIClient()
    theirs.force_authenticate(user=other_user)
    make(theirs)
    make(theirs)

    assert make(auth_client)["title"] == "Untitled Tournament 1"


def test_a_renamed_tournament_stops_holding_its_number(auth_client):
    body = make(auth_client)
    Tournament.objects.filter(pk=body["id"]).update(title="Grand Finals")

    # Nothing numbered is left, so the next one starts again at 1.
    assert make(auth_client)["title"] == "Untitled Tournament 1"


def test_a_title_that_merely_starts_with_the_base_is_not_a_counter(auth_client):
    """
    "Untitled Tournament 4 Redemption" is a name somebody chose, not the
    counter. Matching it would let a rename silently jump the sequence.
    """
    make(auth_client, title="Untitled Tournament 9 Redemption")

    # It starts with the base, so it counts as *an* untitled one, but its 9 is
    # not a counter — the next is 2, not 10.
    assert make(auth_client)["title"] == "Untitled Tournament 2"


def test_an_anonymous_bracket_gets_the_bare_name(api_client):
    """
    No account to scope a count to, and nobody holds a list of these to
    disambiguate — the quick-start host has exactly one, the one in front of
    them.
    """
    body = make(api_client)

    assert body["title"] == "Untitled Tournament"
