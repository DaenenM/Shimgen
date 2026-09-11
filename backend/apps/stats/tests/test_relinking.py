"""
Changing a tournament's stats board after it has been created.

The board is chosen on the new-tournament form, which is the moment a host is
least likely to have thought about it — the bracket is the thing they came for.
Before this, that first choice was final: a night that should have counted
towards the league simply did not, and the only fix was to run it again.

Switching is a *move*, not a second link. `BoardLink.tournament` is one-to-one,
and the old board has to give back what this tournament gave it — otherwise a
switch leaves tonight's wins sitting on a board the tournament no longer feeds.
"""

import pytest

from apps.stats.awarding import ensure_automatic_columns
from apps.stats.models import BoardLink, StatsBoard, StatsColumn
from apps.tournaments.models import Tournament


@pytest.fixture
def table(user):
    board = StatsBoard.objects.create(name="League", owner=user)
    table = board.tables.create(name="Tournaments", position=0)
    ensure_automatic_columns(table)
    return table


@pytest.fixture
def other_board(user):
    board = StatsBoard.objects.create(name="Season Two", owner=user)
    table = board.tables.create(name="Tournaments", position=0)
    ensure_automatic_columns(table)
    return board


def make_tournament(client, **extra):
    response = client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_teams": [
                {"label": "A", "members": ["Benis"]},
                {"label": "B", "members": ["Trev"]},
            ],
            **extra,
        },
        format="json",
    )
    assert response.status_code == 201
    return response.data["id"]


@pytest.mark.django_db
def test_a_board_can_be_linked_after_the_tournament_was_created(auth_client, table):
    # The forgotten-on-the-form case this exists for.
    tournament_id = make_tournament(auth_client)
    assert not BoardLink.objects.filter(tournament_id=tournament_id).exists()

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": table.board.slug},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["stats_board"]["slug"] == table.board.slug

    link = BoardLink.objects.get(tournament_id=tournament_id)
    assert link.table_id == table.id
    # Players are enrolled on the way in, so the board is tonight's team sheet
    # straight away rather than only once somebody wins.
    assert {row.display_name for row in table.rows.all()} == {"Benis", "Trev"}


@pytest.mark.django_db
def test_switching_boards_takes_the_numbers_off_the_first_one(auth_client, table, other_board):
    tournament_id = make_tournament(auth_client, stats_board=table.board.slug)

    # Play it out, so the first board has actually been credited.
    tournament = Tournament.objects.get(pk=tournament_id)
    match = tournament.matches.first()
    auth_client.post(
        f"/api/v1/matches/{match.id}/report/",
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    won = StatsColumn.Role.TOURNAMENTS_WON
    awarded = [entry.count for entry in table.columns.get(role=won).entries.all() if entry.count]
    assert awarded, "the first board should have been credited before the switch"

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": other_board.slug},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["stats_board"]["slug"] == other_board.slug

    # The link moved...
    link = BoardLink.objects.get(tournament_id=tournament_id)
    assert link.stats_table.board_id == other_board.id

    # ...and the first board no longer claims this tournament's win. Rows stay:
    # a player on a board is somebody the crew tracks, not a by-product of one
    # night.
    assert not any(entry.count for entry in table.columns.get(role=won).entries.all())
    assert table.rows.exists()


@pytest.mark.django_db
def test_the_new_board_is_caught_up_on_what_was_already_played(auth_client, table, other_board):
    tournament_id = make_tournament(auth_client, stats_board=table.board.slug)

    tournament = Tournament.objects.get(pk=tournament_id)
    match = tournament.matches.first()
    auth_client.post(
        f"/api/v1/matches/{match.id}/report/",
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    auth_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": other_board.slug},
        format="json",
    )

    # A board linked halfway through a night shows that night, not only the part
    # of it reported after the link.
    new_table = other_board.tables.first()
    played = new_table.columns.get(role=StatsColumn.Role.PLAYED)
    assert any(entry.count for entry in played.entries.all())


@pytest.mark.django_db
def test_an_empty_board_unlinks(auth_client, table):
    tournament_id = make_tournament(auth_client, stats_board=table.board.slug)

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": ""},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["stats_board"] is None
    assert not BoardLink.objects.filter(tournament_id=tournament_id).exists()


@pytest.mark.django_db
def test_relinking_the_same_board_is_a_no_op(auth_client, table):
    # A double-tap on a phone must not strip the board and put it back, which
    # would retract the award and re-enrol everybody for no reason.
    tournament_id = make_tournament(auth_client, stats_board=table.board.slug)
    before = BoardLink.objects.get(tournament_id=tournament_id)

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": table.board.slug},
        format="json",
    )

    assert response.status_code == 200
    after = BoardLink.objects.get(tournament_id=tournament_id)
    assert after.pk == before.pk


@pytest.mark.django_db
def test_a_stranger_cannot_change_the_board(api_client, auth_client, table, other_user):
    tournament_id = make_tournament(auth_client)

    api_client.force_authenticate(user=other_user)
    response = api_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": table.board.slug},
        format="json",
    )

    # 404 rather than 403: someone with no part in this tournament cannot see it
    # at all, and saying "forbidden" would confirm it exists to somebody with no
    # business knowing that.
    assert response.status_code == 404
    assert not BoardLink.objects.filter(tournament_id=tournament_id).exists()


@pytest.mark.django_db
def test_you_cannot_move_a_tournament_onto_a_board_you_cannot_write_to(
    api_client, user, other_user
):
    # The board belongs to somebody else, so linking would write onto their
    # record. Refused outright rather than silently dropped.
    api_client.force_authenticate(user=other_user)
    tournament_id = make_tournament(api_client)

    theirs = StatsBoard.objects.create(name="Not yours", owner=user)
    ensure_automatic_columns(theirs.tables.create(name="Tournaments", position=0))

    response = api_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": theirs.slug},
        format="json",
    )

    assert response.status_code == 400
    assert not BoardLink.objects.filter(tournament_id=tournament_id).exists()


@pytest.mark.django_db
def test_an_unknown_board_is_refused(auth_client, table):
    tournament_id = make_tournament(auth_client, stats_board=table.board.slug)

    response = auth_client.post(
        f"/api/v1/tournaments/{tournament_id}/stats-board/",
        {"stats_board": "nope"},
        format="json",
    )

    assert response.status_code == 400
    # The board it already had is untouched by a failed move.
    assert BoardLink.objects.get(tournament_id=tournament_id).stats_table.board_id == table.board_id
