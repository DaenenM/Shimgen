"""
Stats boards: structure, tallying and access.

The behaviour that matters most here is that a shared board stays the owner's
board — an editor can count wins all night without being able to reshape or
re-share what everyone's history lives in.
"""

import pytest

from apps.accounts.models import Friendship
from apps.stats.models import BoardAccess, StatsBoard, StatsEntry, StatsRow


@pytest.fixture
def board(user):
    board = StatsBoard.objects.create(name="Pummel Party Wins", owner=user)
    table = board.tables.create(name="Solo", position=0)
    table.columns.create(name="Wins", emoji="\N{TRIDENT EMBLEM}", position=0)
    return board


@pytest.fixture
def solo(board):
    return board.tables.first()


@pytest.fixture
def wins(solo):
    return solo.columns.first()


# ── Creating ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creating_a_board_gives_it_a_table_and_column_to_tally_into(auth_client):
    response = auth_client.post("/api/v1/boards/", {"name": "Pummel Party Wins"}, format="json")

    assert response.status_code == 201

    board = StatsBoard.objects.get(slug=response.data["slug"])
    table = board.tables.first()
    assert table is not None, "a board with no table cannot be tallied into"
    assert table.columns.count() == 1


@pytest.mark.django_db
def test_a_board_needs_an_account(api_client):
    response = api_client.post("/api/v1/boards/", {"name": "Anon"}, format="json")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_listing_shows_only_your_own_and_shared_boards(auth_client, other_user):
    StatsBoard.objects.create(name="Someone else's", owner=other_user)
    auth_client.post("/api/v1/boards/", {"name": "Mine"}, format="json")

    response = auth_client.get("/api/v1/boards/")

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Mine"]


# ── Structure ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_second_table_can_be_added_to_one_board(auth_client, board):
    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/tables/",
        {"name": "Teams", "emoji": "\N{FLEUR-DE-LIS}"},
        format="json",
    )

    assert response.status_code == 201
    assert [t.name for t in board.tables.all()] == ["Solo", "Teams"]
    assert response.data["columns"][0]["emoji"] == "\N{FLEUR-DE-LIS}"


@pytest.mark.django_db
def test_columns_carry_their_own_emoji(auth_client, solo):
    response = auth_client.post(
        f"/api/v1/stats-tables/{solo.id}/columns/",
        {"name": "Podiums", "emoji": "\N{SPORTS MEDAL}"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["emoji"] == "\N{SPORTS MEDAL}"


@pytest.mark.django_db
def test_a_duplicate_column_name_is_refused(auth_client, solo):
    response = auth_client.post(
        f"/api/v1/stats-tables/{solo.id}/columns/", {"name": "Wins"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_rows_can_be_pasted_as_plain_names(auth_client, solo):
    response = auth_client.post(
        f"/api/v1/stats-tables/{solo.id}/rows/",
        {"names": ["Brett", "Kumar", "Sammy"]},
        format="json",
    )

    assert response.status_code == 201
    assert [row.display_name for row in solo.rows.all()] == ["Brett", "Kumar", "Sammy"]


@pytest.mark.django_db
def test_re_pasting_a_list_adds_only_the_new_names(auth_client, solo):
    auth_client.post(
        f"/api/v1/stats-tables/{solo.id}/rows/", {"names": ["Brett", "Kumar"]}, format="json"
    )
    auth_client.post(
        f"/api/v1/stats-tables/{solo.id}/rows/",
        {"names": ["brett", "Kumar", "Trev"]},
        format="json",
    )

    assert [row.display_name for row in solo.rows.all()] == ["Brett", "Kumar", "Trev"]


# ── Tallying ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_win_can_be_added_by_hand_with_no_tournament(auth_client, board, solo, wins):
    row = StatsRow.objects.create(table=solo, label="Brett")

    for _ in range(3):
        response = auth_client.post(
            f"/api/v1/boards/{board.slug}/award/",
            {"row": row.id, "column": wins.id, "delta": 1},
            format="json",
        )

    assert response.status_code == 200
    assert response.data["count"] == 3


@pytest.mark.django_db
def test_a_win_can_be_taken_back(auth_client, board, solo, wins):
    row = StatsRow.objects.create(table=solo, label="Brett")
    StatsEntry.objects.create(row=row, column=wins, count=2)

    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/award/",
        {"row": row.id, "column": wins.id, "delta": -1},
        format="json",
    )

    assert response.data["count"] == 1


@pytest.mark.django_db
def test_undoing_past_zero_stops_at_zero(auth_client, board, solo, wins):
    # Negative counts would render as no emoji at all, and then take several
    # clicks to climb back to visible.
    row = StatsRow.objects.create(table=solo, label="Brett")

    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/award/",
        {"row": row.id, "column": wins.id, "delta": -5},
        format="json",
    )

    assert response.data["count"] == 0


@pytest.mark.django_db
def test_a_row_cannot_be_tallied_into_another_tables_column(auth_client, board, solo, wins):
    teams = board.tables.create(name="Teams", position=1)
    other_column = teams.columns.create(name="Wins", emoji="\N{FLEUR-DE-LIS}")
    row = StatsRow.objects.create(table=solo, label="Brett")

    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/award/",
        {"row": row.id, "column": other_column.id},
        format="json",
    )

    assert response.status_code == 400


# ── Access ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_stranger_may_read_a_board_but_not_change_it(api_client, board, solo, wins):
    # Boards are shared by link, like spectator brackets.
    assert api_client.get(f"/api/v1/boards/{board.slug}/").status_code == 200

    row = StatsRow.objects.create(table=solo, label="Brett")
    response = api_client.post(
        f"/api/v1/boards/{board.slug}/award/",
        {"row": row.id, "column": wins.id},
        format="json",
    )
    assert response.status_code in (400, 401, 403)


@pytest.mark.django_db
def test_an_invited_editor_can_tally(api_client, board, solo, wins, other_user):
    BoardAccess.objects.create(board=board, user=other_user)
    api_client.force_authenticate(user=other_user)
    row = StatsRow.objects.create(table=solo, label="Brett")

    response = api_client.post(
        f"/api/v1/boards/{board.slug}/award/",
        {"row": row.id, "column": wins.id},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["count"] == 1


@pytest.mark.django_db
def test_an_editor_cannot_hand_out_access(api_client, board, other_user, django_user_model):
    # An editor who could share the board could share it with anyone, which
    # would leave the owner's control over it nominal.
    BoardAccess.objects.create(board=board, user=other_user)
    django_user_model.objects.create_user(
        username="kumar", email="kumar@example.com", password="test-password-123"
    )
    api_client.force_authenticate(user=other_user)

    response = api_client.post(
        f"/api/v1/boards/{board.slug}/people/", {"email": "kumar@example.com"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_the_owner_can_share_the_board_with_a_friend(auth_client, board, user, other_user):
    Friendship.objects.create(from_user=user, to_user=other_user, status=Friendship.Status.ACCEPTED)

    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/people/", {"email": other_user.email}, format="json"
    )

    assert response.status_code == 201
    assert board.may_edit(other_user)


@pytest.mark.django_db
def test_a_board_cannot_be_shared_with_someone_who_is_not_a_friend(auth_client, board, other_user):
    # Editing writes into everyone's history, so it takes a mutual link rather
    # than knowing an email address.
    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/people/", {"email": other_user.email}, format="json"
    )

    assert response.status_code == 400
    assert not board.may_edit(other_user)


@pytest.mark.django_db
def test_a_pending_friend_request_is_not_enough(auth_client, board, user, other_user):
    Friendship.objects.create(from_user=user, to_user=other_user)

    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/people/", {"email": other_user.email}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_a_friend_can_be_added_by_account_id(auth_client, board, user, other_user):
    # What the friends picker sends, rather than making the owner retype an
    # email they already chose from a list.
    Friendship.objects.create(from_user=other_user, to_user=user, status=Friendship.Status.ACCEPTED)

    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/people/", {"user": other_user.id}, format="json"
    )

    assert response.status_code == 201
    assert board.may_edit(other_user)


@pytest.mark.django_db
def test_sharing_with_an_unknown_email_says_so(auth_client, board):
    response = auth_client.post(
        f"/api/v1/boards/{board.slug}/people/", {"email": "nobody@example.com"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_access_can_be_taken_away(auth_client, board, other_user):
    BoardAccess.objects.create(board=board, user=other_user)

    response = auth_client.delete(f"/api/v1/boards/{board.slug}/people/{other_user.id}/")

    assert response.status_code == 204
    assert not board.may_edit(other_user)


@pytest.mark.django_db
def test_only_the_owner_may_delete_a_board(api_client, board, other_user):
    BoardAccess.objects.create(board=board, user=other_user)
    api_client.force_authenticate(user=other_user)

    response = api_client.delete(f"/api/v1/boards/{board.slug}/")

    assert response.status_code == 400
    assert StatsBoard.objects.filter(pk=board.pk).exists()


# ── Reading ──────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_the_detail_view_returns_the_whole_board(auth_client, board, solo, wins):
    row = StatsRow.objects.create(table=solo, label="Brett")
    StatsEntry.objects.create(row=row, column=wins, count=8)

    response = auth_client.get(f"/api/v1/boards/{board.slug}/")

    table = response.data["tables"][0]
    assert table["name"] == "Solo"
    assert table["columns"][0]["emoji"] == "\N{TRIDENT EMBLEM}"
    assert table["rows"][0]["counts"][str(wins.id)] == 8


@pytest.mark.django_db
def test_a_removed_roster_player_does_not_erase_their_wins(auth_client, board, solo, wins, user):
    from apps.groups.models import Player

    player = Player.objects.create(owner=user, display_name="Brett")
    row = StatsRow.objects.create(table=solo, player=player, label="Brett")
    StatsEntry.objects.create(row=row, column=wins, count=8)

    player.delete()

    row.refresh_from_db()
    assert row.player_id is None
    assert row.display_name == "Brett"
    assert StatsEntry.objects.get(pk=row.entries.first().pk).count == 8


@pytest.mark.django_db
def test_the_owner_can_delete_their_board(auth_client, board):
    response = auth_client.delete(f"/api/v1/boards/{board.slug}/")

    assert response.status_code == 204
    assert not StatsBoard.objects.filter(pk=board.pk).exists()


@pytest.mark.django_db
def test_deleting_a_board_takes_its_tables_and_tallies(auth_client, board, solo, wins):
    row = StatsRow.objects.create(table=solo, label="Brett")
    StatsEntry.objects.create(row=row, column=wins, count=8)

    auth_client.delete(f"/api/v1/boards/{board.slug}/")

    # Nothing orphaned behind: the tables, rows and counts go with it.
    assert not StatsRow.objects.filter(pk=row.pk).exists()
    assert not StatsEntry.objects.filter(row_id=row.pk).exists()


@pytest.mark.django_db
def test_a_boards_slug_is_opaque_rather_than_its_name(auth_client):
    # The shared URL carries the name as its own last segment, so deriving the
    # slug from it too repeated the name — /stats/saturday-league-4248/saturday-league.
    response = auth_client.post("/api/v1/boards/", {"name": "Saturday League"}, format="json")

    assert response.data["slug"] != "saturday-league"
    assert "saturday" not in response.data["slug"]


@pytest.mark.django_db
def test_two_boards_with_the_same_name_both_work(auth_client):
    first = auth_client.post("/api/v1/boards/", {"name": "League"}, format="json")
    second = auth_client.post("/api/v1/boards/", {"name": "League"}, format="json")

    assert first.data["slug"] != second.data["slug"]
    assert auth_client.get(f"/api/v1/boards/{first.data['slug']}/").status_code == 200
    assert auth_client.get(f"/api/v1/boards/{second.data['slug']}/").status_code == 200
