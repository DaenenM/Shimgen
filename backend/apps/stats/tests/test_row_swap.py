"""
Swapping a hand-typed row for a real account.

The case: you tallied "Brett" for a season before Brett had an account, and now
he has one. Re-typing the name would lose the eight wins already on the row, so
the row is kept and its `player` link is pointed at the real person instead.

`player` being writable is what makes that possible — and is also why it needs
guarding, since attaching an arbitrary roster entry would staple somebody else's
account to a board they have nothing to do with.
"""

import pytest

from apps.accounts.models import Friendship
from apps.groups.models import Player
from apps.stats.models import StatsBoard

ROWS = "/api/v1/stats-rows/"


@pytest.fixture
def board(user):
    board = StatsBoard.objects.create(name="Pummel Party Wins", owner=user)
    table = board.tables.create(name="Solo", position=0)
    table.columns.create(name="Wins", position=0)
    return board


@pytest.fixture
def table(board):
    return board.tables.first()


@pytest.fixture
def wins(table):
    return table.columns.first()


@pytest.fixture
def typed(table):
    """A plain name, tallied before the person had an account."""
    return table.rows.create(label="Brett", position=0)


@pytest.fixture
def friend(user, other_user):
    """`other_user`, befriended and therefore on `user`'s roster."""
    Friendship.objects.create(from_user=user, to_user=other_user, status=Friendship.Status.ACCEPTED)
    return Player.objects.create(owner=user, display_name=other_user.name, user=other_user)


@pytest.mark.django_db
def test_a_typed_row_can_be_pointed_at_a_real_account(auth_client, typed, friend, other_user):
    response = auth_client.patch(
        f"{ROWS}{typed.id}/",
        {"player": friend.id, "label": friend.display_name},
        format="json",
    )

    assert response.status_code == 200

    typed.refresh_from_db()
    assert typed.player_id == friend.id
    assert typed.display_name == other_user.name


@pytest.mark.django_db
def test_the_tallies_already_on_the_row_survive(auth_client, typed, wins, friend):
    # The whole reason to swap rather than delete and re-add.
    typed.entries.create(column=wins, count=8)

    auth_client.patch(f"{ROWS}{typed.id}/", {"player": friend.id}, format="json")

    assert typed.entries.get(column=wins).count == 8


@pytest.mark.django_db
def test_you_cannot_attach_somebody_elses_roster_entry(api_client, typed, other_user, user):
    # `player` is writable, so without a check this endpoint is a way to staple
    # a stranger's account — and their future results — onto any board you can
    # edit. The roster entry here belongs to `other_user`, not to the editor.
    theirs = Player.objects.create(owner=other_user, display_name="Not Yours", user=other_user)

    api_client.force_authenticate(user=user)
    response = api_client.patch(f"{ROWS}{typed.id}/", {"player": theirs.id}, format="json")

    assert response.status_code == 400
    typed.refresh_from_db()
    assert typed.player_id is None


@pytest.mark.django_db
def test_a_row_reports_the_account_behind_it(auth_client, board, typed, friend, other_user):
    # The swap list leaves out anyone already on the table, and it has to match
    # on the account rather than the name — a typed "Brett" and the real Brett
    # are the same person under two different strings.
    auth_client.patch(f"{ROWS}{typed.id}/", {"player": friend.id}, format="json")

    detail = auth_client.get(f"/api/v1/boards/{board.slug}/").data
    row = detail["tables"][0]["rows"][0]

    assert row["player_user_id"] == other_user.id
    assert row["is_friend"] is True


@pytest.mark.django_db
def test_a_plain_row_reports_no_account(auth_client, board, typed):
    detail = auth_client.get(f"/api/v1/boards/{board.slug}/").data
    row = detail["tables"][0]["rows"][0]

    assert row["player_user_id"] is None
    assert row["is_friend"] is False
    assert row["is_self"] is False


@pytest.mark.django_db
def test_your_own_row_says_so(auth_client, board, table, user):
    mine = Player.objects.create(owner=user, display_name=user.name, user=user)
    table.rows.create(player=mine, label=user.name, position=1)

    detail = auth_client.get(f"/api/v1/boards/{board.slug}/").data
    row = next(r for r in detail["tables"][0]["rows"] if r["player_user_id"] == user.id)

    assert row["is_self"] is True


@pytest.mark.django_db
def test_a_viewer_cannot_swap_a_row(api_client, board, typed, other_user):
    # Reads are open to anyone holding the link; writes are not.
    api_client.force_authenticate(user=other_user)
    response = api_client.patch(f"{ROWS}{typed.id}/", {"label": "Mine now"}, format="json")

    assert response.status_code in (403, 404)
    typed.refresh_from_db()
    assert typed.label == "Brett"


@pytest.mark.django_db
def test_renaming_a_row_keeps_its_tallies_and_its_link(auth_client, typed, wins, friend):
    # Renaming says what the row is *called*, not who it is. The label takes
    # precedence over a linked account's name, so this is also how a board ends
    # up calling somebody something other than their account name — deliberate,
    # and the tallies and the link are untouched either way.
    typed.entries.create(column=wins, count=5)
    auth_client.patch(f"{ROWS}{typed.id}/", {"player": friend.id}, format="json")

    response = auth_client.patch(f"{ROWS}{typed.id}/", {"label": "Shim"}, format="json")

    assert response.status_code == 200

    typed.refresh_from_db()
    assert typed.display_name == "Shim"
    assert typed.player_id == friend.id
    assert typed.entries.get(column=wins).count == 5


@pytest.mark.django_db
def test_a_plain_row_can_be_renamed(auth_client, typed):
    response = auth_client.patch(f"{ROWS}{typed.id}/", {"label": "Bretty"}, format="json")

    assert response.status_code == 200
    typed.refresh_from_db()
    assert typed.display_name == "Bretty"


@pytest.mark.django_db
def test_a_row_can_be_unlinked_from_its_account(auth_client, typed, wins, friend):
    # Clicking the friend badge in edit mode cuts the row loose. The row, its
    # label and its tallies all stay — only the link goes, which is what makes
    # this safe to offer rather than a destructive act.
    typed.entries.create(column=wins, count=4)
    auth_client.patch(f"{ROWS}{typed.id}/", {"player": friend.id}, format="json")

    response = auth_client.patch(f"{ROWS}{typed.id}/", {"player": None}, format="json")

    assert response.status_code == 200

    typed.refresh_from_db()
    assert typed.player_id is None
    assert typed.display_name == "Brett"
    assert typed.entries.get(column=wins).count == 4


@pytest.mark.django_db
def test_an_unlinked_row_no_longer_claims_a_friend(auth_client, board, typed, friend):
    auth_client.patch(f"{ROWS}{typed.id}/", {"player": friend.id}, format="json")
    auth_client.patch(f"{ROWS}{typed.id}/", {"player": None}, format="json")

    detail = auth_client.get(f"/api/v1/boards/{board.slug}/").data
    row = detail["tables"][0]["rows"][0]

    assert row["player_user_id"] is None
    assert row["is_friend"] is False
