"""
Tournaments feeding a stats board.

The rule under test throughout: a win belongs to **people, not entrants**. A 3v3
league won by "Team Benis" is three individual wins, because the team name is a
Saturday-night arrangement while the players persist.
"""

import pytest

from apps.groups.models import Player
from apps.stats.awarding import apply_tournament_result, winning_players
from apps.stats.models import BoardAccess, BoardLink, StatsBoard, StatsRow
from apps.tournaments.brackets.advance import report_result
from apps.tournaments.brackets.single_elimination import generate_single_elimination
from apps.tournaments.models import Entrant, Tournament
from apps.tournaments.tests.factories import TournamentFactory


@pytest.fixture
def board(user):
    board = StatsBoard.objects.create(name="League", owner=user)
    table = board.tables.create(name="Teams", position=0)
    table.columns.create(name="Wins", emoji="\N{FLEUR-DE-LIS}", position=0)
    return board


@pytest.fixture
def column(board):
    return board.tables.first().columns.first()


def _team_tournament(user, *, squads):
    """A two-entrant bracket whose entrants are teams of roster players."""
    tournament = TournamentFactory(created_by=user, state=Tournament.State.ACTIVE)

    for index, names in enumerate(squads, start=1):
        entrant = Entrant.objects.create(tournament=tournament, label=f"Team {index}", seed=index)
        for name in names:
            player, _ = Player.objects.get_or_create(owner=user, display_name=name)
            entrant.players.add(player)

    generate_single_elimination(tournament, list(tournament.entrants.all()))
    return tournament


def _play_final(tournament, winning_entrant_label):
    """Report the one match so `winning_entrant_label` wins the tournament."""
    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    a_wins = match.a.label == winning_entrant_label
    report_result(match, score_a=1 if a_wins else 0, score_b=0 if a_wins else 1)
    return match


# ── Crediting people, not teams ──────────────────────────────────────────────


@pytest.mark.django_db
def test_every_player_on_the_winning_team_is_credited(user, board, column):
    tournament = _team_tournament(
        user, squads=[["Benis", "Brett", "Kumar"], ["Trev", "Kal", "Cody"]]
    )
    BoardLink.objects.create(tournament=tournament, column=column)
    _play_final(tournament, "Team 1")

    link = tournament.stats_link
    assert apply_tournament_result(link) == 3

    tallies = {
        row.display_name: row.entries.get(column=column).count for row in column.table.rows.all()
    }
    assert tallies == {"Benis": 1, "Brett": 1, "Kumar": 1}


@pytest.mark.django_db
def test_the_team_name_is_never_a_row(user, board, column):
    tournament = _team_tournament(user, squads=[["Benis", "Brett"], ["Trev", "Kal"]])
    BoardLink.objects.create(tournament=tournament, column=column)
    _play_final(tournament, "Team 1")
    apply_tournament_result(tournament.stats_link)

    names = {row.display_name for row in column.table.rows.all()}
    assert "Team 1" not in names
    assert names == {"Benis", "Brett"}


@pytest.mark.django_db
def test_losers_are_not_credited(user, board, column):
    tournament = _team_tournament(user, squads=[["Benis"], ["Trev"]])
    BoardLink.objects.create(tournament=tournament, column=column)
    _play_final(tournament, "Team 1")
    apply_tournament_result(tournament.stats_link)

    assert not StatsRow.objects.filter(table=column.table, label="Trev").exists()


@pytest.mark.django_db
def test_an_existing_row_is_topped_up_rather_than_duplicated(user, board, column):
    tournament = _team_tournament(user, squads=[["Benis", "Brett"], ["Trev"]])
    player = Player.objects.get(owner=user, display_name="Brett")
    row = StatsRow.objects.create(table=column.table, player=player, label="Brett")
    row.entries.create(column=column, count=6)

    BoardLink.objects.create(tournament=tournament, column=column)
    _play_final(tournament, "Team 1")
    apply_tournament_result(tournament.stats_link)

    assert column.table.rows.filter(player=player).count() == 1
    assert row.entries.get(column=column).count == 7


@pytest.mark.django_db
def test_awarding_twice_does_not_double_count(user, board, column):
    # A bracket can be corrected after it finishes, which re-runs completion.
    tournament = _team_tournament(user, squads=[["Benis"], ["Trev"]])
    BoardLink.objects.create(tournament=tournament, column=column)
    _play_final(tournament, "Team 1")

    link = tournament.stats_link
    assert apply_tournament_result(link) == 1
    assert apply_tournament_result(link) == 0

    row = column.table.rows.get(label="Benis")
    assert row.entries.get(column=column).count == 1


@pytest.mark.django_db
def test_an_unfinished_tournament_credits_nobody(user, board, column):
    tournament = _team_tournament(user, squads=[["Benis"], ["Trev"]])
    BoardLink.objects.create(tournament=tournament, column=column)

    assert winning_players(tournament) == []
    assert apply_tournament_result(tournament.stats_link) == 0


# ── Linking through the API ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_tournament_can_be_linked_to_a_column_on_creation(auth_client, board, column):
    response = auth_client.post(
        "/api/v1/tournaments/",
        {
            "title": "Saturday league",
            "format": "single",
            "entrant_labels": ["A", "B"],
            "stats_column": column.id,
        },
        format="json",
    )

    assert response.status_code == 201
    link = BoardLink.objects.get(tournament_id=response.data["id"])
    assert link.column_id == column.id


@pytest.mark.django_db
def test_you_cannot_link_to_a_board_you_have_no_rights_on(api_client, board, column, other_user):
    api_client.force_authenticate(user=other_user)

    response = api_client.post(
        "/api/v1/tournaments/",
        {
            "title": "Cheeky",
            "format": "single",
            "entrant_labels": ["A", "B"],
            "stats_column": column.id,
        },
        format="json",
    )

    assert response.status_code == 400
    assert not BoardLink.objects.exists()


@pytest.mark.django_db
def test_an_invited_editor_can_link_a_tournament(api_client, board, column, other_user):
    # This is the point of sharing: a friend runs Saturday's bracket and it
    # still counts towards the board the owner set up.
    BoardAccess.objects.create(board=board, user=other_user)
    api_client.force_authenticate(user=other_user)

    response = api_client.post(
        "/api/v1/tournaments/",
        {
            "title": "Brett's night",
            "format": "single",
            "entrant_labels": ["A", "B"],
            "stats_column": column.id,
        },
        format="json",
    )

    assert response.status_code == 201
    assert BoardLink.objects.filter(tournament_id=response.data["id"]).exists()


@pytest.mark.django_db
def test_finishing_a_linked_tournament_awards_through_the_api(auth_client, user, board, column):
    tournament = _team_tournament(user, squads=[["Benis", "Brett"], ["Trev"]])
    BoardLink.objects.create(tournament=tournament, column=column)

    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    a_wins = match.a.label == "Team 1"

    response = auth_client.post(
        f"/api/v1/matches/{match.id}/report/",
        {"score_a": 1 if a_wins else 0, "score_b": 0 if a_wins else 1},
        format="json",
    )
    assert response.status_code == 200

    tournament.refresh_from_db()
    assert tournament.state == Tournament.State.COMPLETE

    tallies = {
        row.display_name: row.entries.get(column=column).count for row in column.table.rows.all()
    }
    assert tallies == {"Benis": 1, "Brett": 1}
