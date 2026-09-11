"""
Being counted on a board is enough to see it.

A friend added to somebody's stats board could not find it in their own list —
the list asked only "do you own this, or were you granted access", so the person
whose wins were being tallied needed the share link to look at their own record.

Derived rather than granted, and read-only: `may_edit` still asks for owner or
editor, so a viewer sees the board and changes nothing on it.
"""

import pytest

from apps.groups.models import Player
from apps.stats.models import StatsBoard

BOARDS = "/api/v1/boards/"


@pytest.fixture
def board(user):
    board = StatsBoard.objects.create(name="Pummel Party Wins", owner=user)
    table = board.tables.create(name="Solo", position=0)
    table.columns.create(name="Wins", position=0)
    return board


@pytest.fixture
def counted(board, user, other_user):
    """`other_user`, on the board as a row linked to their account."""
    player = Player.objects.create(owner=user, display_name=other_user.name, user=other_user)
    board.tables.first().rows.create(player=player, label=other_user.name, position=0)
    return other_user


@pytest.mark.django_db
def test_someone_counted_on_a_board_finds_it_in_their_list(api_client, board, counted):
    api_client.force_authenticate(user=counted)

    listed = api_client.get(BOARDS).data["results"]

    assert board.slug in [row["slug"] for row in listed]


@pytest.mark.django_db
def test_they_are_a_viewer_rather_than_an_editor(api_client, board, counted):
    api_client.force_authenticate(user=counted)

    row = next(r for r in api_client.get(BOARDS).data["results"] if r["slug"] == board.slug)

    assert row["role"] == "viewer"


@pytest.mark.django_db
def test_a_viewer_cannot_change_the_board(api_client, board, counted):
    # The whole point of deriving this rather than granting access: seeing your
    # own record is not permission to reshape somebody's board.
    assert board.may_edit(counted) is False

    api_client.force_authenticate(user=counted)
    response = api_client.patch(f"{BOARDS}{board.slug}/", {"name": "Mine now"}, format="json")

    assert response.status_code in (403, 400)
    board.refresh_from_db()
    assert board.name == "Pummel Party Wins"


@pytest.mark.django_db
def test_a_row_with_no_account_grants_nobody_anything(api_client, board, user, other_user):
    # A plain name typed onto a board is not a person who can sign in. Only a
    # row linked to an account confers anything.
    player = Player.objects.create(owner=user, display_name="Just A Name")
    board.tables.first().rows.create(player=player, label="Just A Name", position=0)

    api_client.force_authenticate(user=other_user)

    assert board.slug not in [row["slug"] for row in api_client.get(BOARDS).data["results"]]


@pytest.mark.django_db
def test_a_stranger_still_sees_nothing(api_client, board, other_user):
    api_client.force_authenticate(user=other_user)

    assert api_client.get(BOARDS).data["results"] == []


@pytest.mark.django_db
def test_the_owner_is_still_the_owner(api_client, board, user, counted):
    # Adding a viewer must not demote anybody.
    api_client.force_authenticate(user=user)

    row = next(r for r in api_client.get(BOARDS).data["results"] if r["slug"] == board.slug)

    assert row["role"] == "owner"


@pytest.mark.django_db
def test_a_board_is_listed_once_however_many_rows_you_hold(api_client, board, user, counted):
    # Two tables, both counting the same person — the join must not return the
    # board twice.
    second = board.tables.create(name="Teams", position=1)
    player = Player.objects.get(owner=user, user=counted)
    second.rows.create(player=player, label=counted.name, position=0)

    api_client.force_authenticate(user=counted)
    slugs = [row["slug"] for row in api_client.get(BOARDS).data["results"]]

    assert slugs.count(board.slug) == 1
