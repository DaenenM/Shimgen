"""
Boards that keep themselves up to date.

A tracking table carries four columns a linked bracket fills in by itself:
games played, won, lost, and tournaments won. Everyone in the tournament gets a
row the moment it is created — the board is tonight's team sheet as well as its
record — and every one of those numbers is per player, never per team.

The per-game counts are *recomputed* from the match rows rather than
incremented, which is what makes correcting a bracket correct the board.
"""

import pytest

from apps.groups.models import Player
from apps.stats.awarding import (
    apply_tournament_result,
    ensure_automatic_columns,
    sync_tournament_stats,
)
from apps.stats.models import BoardLink, StatsBoard, StatsColumn
from apps.tournaments.brackets.advance import clear_result, report_result
from apps.tournaments.brackets.single_elimination import generate_single_elimination
from apps.tournaments.models import Entrant, Tournament
from apps.tournaments.tests.factories import TournamentFactory


@pytest.fixture
def table(user):
    board = StatsBoard.objects.create(name="League", owner=user)
    table = board.tables.create(name="Season 1", position=0)
    ensure_automatic_columns(table)
    return table


def _column(table, role):
    return table.columns.get(role=role)


def _tally(table, name, role):
    """What `name` has in the column for `role`."""
    row = table.rows.filter(label=name).first()
    if row is None:
        return 0

    entry = row.entries.filter(column=_column(table, role)).first()
    return entry.count if entry else 0


def _tournament(user, *, squads, state=Tournament.State.ACTIVE):
    tournament = TournamentFactory(created_by=user, state=state)

    for index, names in enumerate(squads, start=1):
        entrant = Entrant.objects.create(tournament=tournament, label=f"Team {index}", seed=index)
        for name in names:
            player, _ = Player.objects.get_or_create(owner=user, display_name=name)
            entrant.players.add(player)

    generate_single_elimination(tournament, list(tournament.entrants.all()))
    return tournament


def _win(tournament, label):
    """Report the next open match so the entrant called `label` wins it."""
    match = tournament.matches.filter(winner__isnull=True, a__isnull=False, b__isnull=False).first()
    a_wins = match.a.label == label
    report_result(match, score_a=1 if a_wins else 0, score_b=0 if a_wins else 1)
    return match


# ── The columns ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_tracking_table_has_the_four_tournament_columns(table):
    assert [c.name for c in table.columns.all()] == [
        "Games played",
        "Wins",
        "Losses",
        "Trophies",
    ]


@pytest.mark.django_db
def test_every_tournament_column_renders_as_a_number(table):
    # Every tournament column is a number: the header's emoji already says what
    # it counts, and repeating it down the cells left the rows ragged.
    for role in StatsColumn.Role:
        if role != StatsColumn.Role.MANUAL:
            assert _column(table, role).display == StatsColumn.Display.NUMBER


@pytest.mark.django_db
def test_adding_the_columns_twice_does_not_duplicate_them(table):
    ensure_automatic_columns(table)
    assert table.columns.count() == 4


@pytest.mark.django_db
def test_a_renamed_column_is_not_duplicated(table):
    # Matched on role, not name, so renaming one is safe.
    column = _column(table, StatsColumn.Role.WON)
    column.name = "Wins"
    column.save()

    ensure_automatic_columns(table)

    assert table.columns.count() == 4


@pytest.mark.django_db
def test_a_hand_counted_table_can_be_converted_later(auth_client, user):
    board = StatsBoard.objects.create(name="Pummel", owner=user)
    plain = board.tables.create(name="Solo", position=0)
    plain.columns.create(name="Wins", position=0)

    response = auth_client.post(f"/api/v1/stats-tables/{plain.id}/track-tournaments/")

    assert response.status_code == 200
    # The hand-counted column survives — months of tallies are not thrown away.
    assert [c["name"] for c in response.data["columns"]] == [
        "Wins",
        "Games played",
        # Qualified: the hand-counted "Wins" column already holds that name, and
        # names are unique per table.
        "Wins (tournaments)",
        "Losses",
        "Trophies",
    ]


# ── Enrolling players ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creating_a_linked_tournament_adds_every_player(auth_client, table):
    response = auth_client.post(
        "/api/v1/tournaments/",
        {
            "title": "Saturday",
            "format": "single",
            "entrant_teams": [
                {"label": "Team 1", "members": ["Benis", "Brett"]},
                {"label": "Team 2", "members": ["Trev", "Kal"]},
            ],
            "stats_table": table.id,
        },
        format="json",
    )

    assert response.status_code == 201
    # Everyone, not just the eventual winners — the board is the team sheet too.
    assert {row.display_name for row in table.rows.all()} == {"Benis", "Brett", "Trev", "Kal"}


@pytest.mark.django_db
def test_a_later_tournament_adds_only_the_new_faces(auth_client, table):
    for members in (["Benis", "Brett"], ["Benis", "Kumar"]):
        auth_client.post(
            "/api/v1/tournaments/",
            {
                "format": "single",
                "entrant_teams": [
                    {"label": "A", "members": members},
                    {"label": "B", "members": ["Trev"]},
                ],
                "stats_table": table.id,
            },
            format="json",
        )

    names = [row.display_name for row in table.rows.all()]
    assert sorted(names) == ["Benis", "Brett", "Kumar", "Trev"]
    assert names.count("Benis") == 1


@pytest.mark.django_db
def test_a_name_typed_by_hand_is_adopted_rather_than_duplicated(auth_client, table, user):
    # Somebody wrote "Benis" onto the board before he ever played a bracket.
    table.rows.create(label="Benis", position=0)

    auth_client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_teams": [
                {"label": "A", "members": ["Benis"]},
                {"label": "B", "members": ["Trev"]},
            ],
            "stats_table": table.id,
        },
        format="json",
    )

    rows = table.rows.filter(label="Benis")
    assert rows.count() == 1
    assert rows.first().player_id is not None, "the hand-typed row should be linked, not replaced"


@pytest.mark.django_db
def test_the_team_name_never_becomes_a_row(auth_client, table):
    auth_client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_teams": [
                {"label": "Team Benis", "members": ["Benis", "Brett"]},
                {"label": "Team Trev", "members": ["Trev"]},
            ],
            "stats_table": table.id,
        },
        format="json",
    )

    names = {row.display_name for row in table.rows.all()}
    assert names == {"Benis", "Brett", "Trev"}


# ── Counting games ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_played_match_counts_for_everyone_on_both_sides(user, table):
    tournament = _tournament(user, squads=[["Benis", "Brett"], ["Trev", "Kal"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)
    _win(tournament, "Team 1")
    sync_tournament_stats(link)

    for winner in ("Benis", "Brett"):
        assert _tally(table, winner, StatsColumn.Role.PLAYED) == 1
        assert _tally(table, winner, StatsColumn.Role.WON) == 1
        assert _tally(table, winner, StatsColumn.Role.LOST) == 0

    for loser in ("Trev", "Kal"):
        assert _tally(table, loser, StatsColumn.Role.PLAYED) == 1
        assert _tally(table, loser, StatsColumn.Role.WON) == 0
        assert _tally(table, loser, StatsColumn.Role.LOST) == 1


@pytest.mark.django_db
def test_games_accumulate_across_rounds(user, table):
    tournament = _tournament(user, squads=[["A"], ["B"], ["C"], ["D"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    _win(tournament, "Team 1")
    _win(tournament, "Team 3")
    sync_tournament_stats(link)
    _win(tournament, "Team 1")
    sync_tournament_stats(link)

    # Team 1 played the semifinal and the final and won both.
    assert _tally(table, "A", StatsColumn.Role.PLAYED) == 2
    assert _tally(table, "A", StatsColumn.Role.WON) == 2
    # Team 3 won a semifinal then lost the final.
    assert _tally(table, "C", StatsColumn.Role.PLAYED) == 2
    assert _tally(table, "C", StatsColumn.Role.WON) == 1
    assert _tally(table, "C", StatsColumn.Role.LOST) == 1


@pytest.mark.django_db
def test_syncing_twice_does_not_double_the_numbers(user, table):
    tournament = _tournament(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)
    _win(tournament, "Team 1")

    sync_tournament_stats(link)
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 1


@pytest.mark.django_db
def test_correcting_a_result_corrects_the_board(user, table):
    # The whole reason counts are recomputed rather than incremented.
    tournament = _tournament(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = _win(tournament, "Team 1")
    sync_tournament_stats(link)
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 1

    match.refresh_from_db()
    report_result(
        match,
        score_a=0 if match.a.label == "Team 1" else 1,
        score_b=1 if match.a.label == "Team 1" else 0,
    )
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.WON) == 0
    assert _tally(table, "Benis", StatsColumn.Role.LOST) == 1
    assert _tally(table, "Trev", StatsColumn.Role.WON) == 1


@pytest.mark.django_db
def test_clearing_a_result_walks_the_numbers_back_down(user, table):
    tournament = _tournament(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = _win(tournament, "Team 1")
    sync_tournament_stats(link)

    match.refresh_from_db()
    clear_result(match)
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 0
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 0


@pytest.mark.django_db
def test_a_walkover_is_not_counted_as_a_game(user, table):
    # Three entrants means someone gets a bye. Nobody played it, so it must not
    # inflate the record of whoever drew it.
    tournament = _tournament(user, squads=[["A"], ["B"], ["C"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)
    sync_tournament_stats(link)

    assert _tally(table, "A", StatsColumn.Role.PLAYED) == 0
    assert _tally(table, "A", StatsColumn.Role.WON) == 0


# ── Tournaments won ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_finishing_credits_the_winners_a_tournament(user, table):
    tournament = _tournament(user, squads=[["Benis", "Brett"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)
    _win(tournament, "Team 1")

    assert apply_tournament_result(link) == 2

    for name in ("Benis", "Brett"):
        assert _tally(table, name, StatsColumn.Role.TOURNAMENTS_WON) == 1
    assert _tally(table, "Trev", StatsColumn.Role.TOURNAMENTS_WON) == 0


@pytest.mark.django_db
def test_the_whole_thing_end_to_end(auth_client, table):
    """Create linked, play it out, and the board keeps itself."""
    created = auth_client.post(
        "/api/v1/tournaments/",
        {
            "title": "League night",
            "format": "single",
            "entrant_teams": [
                {"label": "Team Benis", "members": ["Benis", "Brett"]},
                {"label": "Team Trev", "members": ["Trev", "Kal"]},
            ],
            "stats_table": table.id,
        },
        format="json",
    )
    assert created.status_code == 201

    tournament = Tournament.objects.get(pk=created.data["id"])
    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    a_wins = match.a.label == "Team Benis"

    reported = auth_client.post(
        f"/api/v1/matches/{match.id}/report/",
        {"score_a": 1 if a_wins else 0, "score_b": 0 if a_wins else 1},
        format="json",
    )
    assert reported.status_code == 200

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 1
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 1
    assert _tally(table, "Benis", StatsColumn.Role.TOURNAMENTS_WON) == 1
    assert _tally(table, "Trev", StatsColumn.Role.LOST) == 1
    assert _tally(table, "Trev", StatsColumn.Role.TOURNAMENTS_WON) == 0


@pytest.mark.django_db
def test_you_cannot_link_to_a_table_you_have_no_rights_on(api_client, table, other_user):
    api_client.force_authenticate(user=other_user)

    response = api_client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_labels": ["A", "B"],
            "stats_table": table.id,
        },
        format="json",
    )

    assert response.status_code == 400
    assert not BoardLink.objects.exists()


@pytest.mark.django_db
def test_clearing_the_final_takes_the_trophy_back(user, table):
    # A board that says someone won a tournament they are no longer shown as
    # winning is worse than one that is briefly behind.
    tournament = _tournament(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = _win(tournament, "Team 1")
    apply_tournament_result(link)
    assert _tally(table, "Benis", StatsColumn.Role.TOURNAMENTS_WON) == 1

    match.refresh_from_db()
    clear_result(match)
    link.refresh_from_db()
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.TOURNAMENTS_WON) == 0
    assert not link.awarded, "so a re-played final can award again"


@pytest.mark.django_db
def test_a_corrected_final_moves_the_trophy_to_the_new_winner(user, table):
    tournament = _tournament(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = _win(tournament, "Team 1")
    apply_tournament_result(link)

    match.refresh_from_db()
    a_is_benis = match.a.label == "Team 1"
    report_result(match, score_a=0 if a_is_benis else 1, score_b=1 if a_is_benis else 0)
    link.refresh_from_db()
    sync_tournament_stats(link)
    apply_tournament_result(link)

    assert _tally(table, "Benis", StatsColumn.Role.TOURNAMENTS_WON) == 0
    assert _tally(table, "Trev", StatsColumn.Role.TOURNAMENTS_WON) == 1


@pytest.mark.django_db
def test_a_board_can_be_created_tracking_tournaments(auth_client):
    response = auth_client.post(
        "/api/v1/boards/",
        {"name": "League", "tracks_tournaments": True},
        format="json",
    )

    assert response.status_code == 201

    board = StatsBoard.objects.get(slug=response.data["slug"])
    table = board.tables.first()
    assert [c.name for c in table.columns.all()] == [
        "Games played",
        "Wins",
        "Losses",
        "Trophies",
    ]


@pytest.mark.django_db
def test_a_board_created_without_the_toggle_is_hand_counted(auth_client):
    response = auth_client.post("/api/v1/boards/", {"name": "Pummel"}, format="json")

    table = StatsBoard.objects.get(slug=response.data["slug"]).tables.first()
    assert [c.role for c in table.columns.all()] == [StatsColumn.Role.MANUAL]


# ── Linking by board ─────────────────────────────────────────────────────────
#
# Naming the board is enough. The columns a tournament fills are fixed, so
# asking which table as well was a second question with one sensible answer.


@pytest.mark.django_db
def test_a_tournament_links_by_naming_the_board_alone(auth_client, table):
    response = auth_client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_teams": [
                {"label": "A", "members": ["Benis"]},
                {"label": "B", "members": ["Trev"]},
            ],
            "stats_board": table.board.slug,
        },
        format="json",
    )

    assert response.status_code == 201

    link = BoardLink.objects.get(tournament_id=response.data["id"])
    assert link.table_id == table.id
    # And the players are already on it, before a game is played.
    assert {row.display_name for row in table.rows.all()} == {"Benis", "Trev"}


@pytest.mark.django_db
def test_linking_a_hand_counted_board_gives_it_the_tournament_columns(auth_client, user):
    # The host asked for this night to count; adding the columns is the thing
    # that makes it count, so it beats refusing the link.
    board = StatsBoard.objects.create(name="Pummel", owner=user)
    plain = board.tables.create(name="Solo", position=0)
    plain.columns.create(name="Wins", position=0)

    response = auth_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "stats_board": board.slug},
        format="json",
    )

    assert response.status_code == 201
    roles = {column.role for column in plain.columns.all()}
    assert StatsColumn.Role.TOURNAMENTS_WON in roles
    # The hand-counted tally is untouched.
    assert plain.columns.filter(name="Wins", role=StatsColumn.Role.MANUAL).exists()


@pytest.mark.django_db
def test_the_tracking_table_is_preferred_over_a_hand_counted_one(auth_client, user):
    board = StatsBoard.objects.create(name="Mixed", owner=user)
    board.tables.create(name="Pummel", position=0).columns.create(name="Wins", position=0)
    tracked = board.tables.create(name="League", position=1)
    ensure_automatic_columns(tracked)

    response = auth_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "stats_board": board.slug},
        format="json",
    )

    link = BoardLink.objects.get(tournament_id=response.data["id"])
    assert link.table_id == tracked.id


@pytest.mark.django_db
def test_you_cannot_link_to_a_board_you_have_no_rights_on_by_slug(api_client, table, other_user):
    api_client.force_authenticate(user=other_user)

    response = api_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "stats_board": table.board.slug},
        format="json",
    )

    assert response.status_code == 400
    assert not BoardLink.objects.exists()


@pytest.mark.django_db
def test_an_unknown_board_is_refused(auth_client):
    response = auth_client.post(
        "/api/v1/tournaments/",
        {"format": "single", "entrant_labels": ["A", "B"], "stats_board": "nope"},
        format="json",
    )

    assert response.status_code == 400


# ── Best-of series ───────────────────────────────────────────────────────────
#
# A Bo3 won 2-1 is three games, not one. Counting a series as a single match
# hid every game inside it: a whole night of Bo3s showed one win per round.


def _bo3(user, *, squads):
    """A two-entrant best-of-three."""
    tournament = TournamentFactory(
        created_by=user, state=Tournament.State.ACTIVE, settings={"best_of": {"default": 3}}
    )

    for index, names in enumerate(squads, start=1):
        entrant = Entrant.objects.create(tournament=tournament, label=f"Team {index}", seed=index)
        for name in names:
            player, _ = Player.objects.get_or_create(owner=user, display_name=name)
            entrant.players.add(player)

    generate_single_elimination(tournament, list(tournament.entrants.all()))
    return tournament


@pytest.mark.django_db
def test_a_best_of_three_counts_three_games_not_one(user, table):
    tournament = _bo3(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    benis_is_a = match.a.label == "Team 1"
    report_result(match, score_a=2 if benis_is_a else 1, score_b=1 if benis_is_a else 2)
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 3
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 2
    assert _tally(table, "Benis", StatsColumn.Role.LOST) == 1

    assert _tally(table, "Trev", StatsColumn.Role.PLAYED) == 3
    assert _tally(table, "Trev", StatsColumn.Role.WON) == 1
    assert _tally(table, "Trev", StatsColumn.Role.LOST) == 2


@pytest.mark.django_db
def test_a_sweep_counts_only_the_games_played(user, table):
    # 2-0 is two games, not the three the format allows for.
    tournament = _bo3(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    benis_is_a = match.a.label == "Team 1"
    report_result(match, score_a=2 if benis_is_a else 0, score_b=0 if benis_is_a else 2)
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 2
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 2
    assert _tally(table, "Trev", StatsColumn.Role.LOST) == 2


@pytest.mark.django_db
def test_an_unfinished_series_counts_the_games_played_so_far(user, table):
    # The board tracks the night as it happens rather than jumping at the end.
    tournament = _bo3(user, squads=[["Benis"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    benis_is_a = match.a.label == "Team 1"
    report_result(match, score_a=1 if benis_is_a else 0, score_b=0 if benis_is_a else 1)
    sync_tournament_stats(link)

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 1
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 1
    assert _tally(table, "Trev", StatsColumn.Role.LOST) == 1


@pytest.mark.django_db
def test_the_trophy_still_goes_only_to_the_series_winner(user, table):
    tournament = _bo3(user, squads=[["Benis", "Brett"], ["Trev"]])
    link = BoardLink.objects.create(tournament=tournament, table=table)

    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    benis_is_a = match.a.label == "Team 1"
    report_result(match, score_a=2 if benis_is_a else 1, score_b=1 if benis_is_a else 2)
    sync_tournament_stats(link)
    apply_tournament_result(link)

    # Two games won each in the series, one trophy between the winning side.
    for name in ("Benis", "Brett"):
        assert _tally(table, name, StatsColumn.Role.WON) == 2
        assert _tally(table, name, StatsColumn.Role.TOURNAMENTS_WON) == 1

    assert _tally(table, "Trev", StatsColumn.Role.WON) == 1
    assert _tally(table, "Trev", StatsColumn.Role.TOURNAMENTS_WON) == 0


@pytest.mark.django_db
def test_games_accumulate_across_rounds_of_a_series_bracket(user, table):
    tournament = TournamentFactory(
        created_by=user, state=Tournament.State.ACTIVE, settings={"best_of": {"default": 3}}
    )
    for index, name in enumerate(["A", "B", "C", "D"], start=1):
        entrant = Entrant.objects.create(tournament=tournament, label=f"Team {index}", seed=index)
        player, _ = Player.objects.get_or_create(owner=user, display_name=name)
        entrant.players.add(player)
    generate_single_elimination(tournament, list(tournament.entrants.all()))
    link = BoardLink.objects.create(tournament=tournament, table=table)

    def play(label, winner_games, loser_games):
        match = tournament.matches.filter(
            winner__isnull=True, a__isnull=False, b__isnull=False
        ).first()
        a_wins = match.a.label == label
        report_result(
            match,
            score_a=winner_games if a_wins else loser_games,
            score_b=loser_games if a_wins else winner_games,
        )

    play("Team 1", 2, 1)  # A beats B 2-1
    play("Team 3", 2, 0)  # C beats D 2-0
    play("Team 1", 2, 1)  # A beats C 2-1 in the final

    sync_tournament_stats(link)

    # A: 2-1 then 2-1 -> six games, four won, two lost.
    assert _tally(table, "A", StatsColumn.Role.PLAYED) == 6
    assert _tally(table, "A", StatsColumn.Role.WON) == 4
    assert _tally(table, "A", StatsColumn.Role.LOST) == 2

    # C: 2-0 then 1-2 -> five games, three won, two lost.
    assert _tally(table, "C", StatsColumn.Role.PLAYED) == 5
    assert _tally(table, "C", StatsColumn.Role.WON) == 3
    assert _tally(table, "C", StatsColumn.Role.LOST) == 2


@pytest.mark.django_db
def test_solo_entrants_are_tracked_too(auth_client, table):
    # A solo bracket's entrants are people. Without a Player behind each one a
    # linked board has nobody to count, and stays empty all night.
    created = auth_client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_labels": ["Benis", "Trev"],
            "settings": {"best_of": {"default": 3}},
            "stats_board": table.board.slug,
        },
        format="json",
    )
    assert created.status_code == 201

    assert {row.display_name for row in table.rows.all()} == {"Benis", "Trev"}

    tournament = Tournament.objects.get(pk=created.data["id"])
    match = tournament.matches.filter(a__isnull=False, b__isnull=False).first()
    benis_is_a = match.a.label == "Benis"

    auth_client.post(
        f"/api/v1/matches/{match.id}/report/",
        {"score_a": 2 if benis_is_a else 1, "score_b": 1 if benis_is_a else 2},
        format="json",
    )

    assert _tally(table, "Benis", StatsColumn.Role.PLAYED) == 3
    assert _tally(table, "Benis", StatsColumn.Role.WON) == 2
    assert _tally(table, "Benis", StatsColumn.Role.LOST) == 1
    assert _tally(table, "Benis", StatsColumn.Role.TOURNAMENTS_WON) == 1

    assert _tally(table, "Trev", StatsColumn.Role.WON) == 1
    assert _tally(table, "Trev", StatsColumn.Role.TOURNAMENTS_WON) == 0


@pytest.mark.django_db
def test_undoing_the_final_takes_the_trophy_back(table, user):
    """
    A trophy is credit for a result. Undo the result and the credit has to go
    with it, or the board keeps a win for a bracket that no longer says so.
    """
    tournament = _tournament(user, squads=[["Ann"], ["Bo"], ["Cal"], ["Dee"]])
    BoardLink.objects.create(tournament=tournament, table=table)

    _win(tournament, "Team 1")
    _win(tournament, "Team 3")
    final = _win(tournament, "Team 1")

    tournament.state = Tournament.State.COMPLETE
    tournament.save(update_fields=["state"])
    link = tournament.stats_link
    apply_tournament_result(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 1

    # The host clicked the wrong name. Undo it.
    clear_result(final)
    link.refresh_from_db()
    sync_tournament_stats(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 0


@pytest.mark.django_db
def test_a_corrected_final_moves_the_trophy_to_the_real_winner(table, user):
    """The mistake is undone and the right result recorded in its place."""
    tournament = _tournament(user, squads=[["Ann"], ["Bo"], ["Cal"], ["Dee"]])
    BoardLink.objects.create(tournament=tournament, table=table)

    _win(tournament, "Team 1")
    _win(tournament, "Team 3")
    final = _win(tournament, "Team 1")

    tournament.state = Tournament.State.COMPLETE
    tournament.save(update_fields=["state"])
    link = tournament.stats_link
    apply_tournament_result(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 1

    # Reported the wrong way round: hand it to the other side.
    final.refresh_from_db()
    loser_is_a = final.a.label != "Team 1"
    report_result(final, score_a=1 if loser_is_a else 0, score_b=0 if loser_is_a else 1)

    link.refresh_from_db()
    sync_tournament_stats(link)
    apply_tournament_result(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 0
    assert _tally(table, "Cal", StatsColumn.Role.TOURNAMENTS_WON) == 1


@pytest.mark.django_db
def test_deleting_a_tournament_takes_its_numbers_off_the_board(table, user):
    """
    A deleted tournament must not leave wins behind it. The link cascades away
    on its own, but the tallies it wrote would otherwise stand for ever with
    nothing to explain them.
    """
    from apps.stats.awarding import strip_tournament_from_board

    tournament = _tournament(user, squads=[["Ann"], ["Bo"], ["Cal"], ["Dee"]])
    BoardLink.objects.create(tournament=tournament, table=table)

    _win(tournament, "Team 1")
    _win(tournament, "Team 3")
    _win(tournament, "Team 1")

    tournament.state = Tournament.State.COMPLETE
    tournament.save(update_fields=["state"])
    link = tournament.stats_link
    sync_tournament_stats(link)
    apply_tournament_result(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 1
    assert _tally(table, "Ann", StatsColumn.Role.PLAYED) > 0

    link.refresh_from_db()
    strip_tournament_from_board(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 0
    assert _tally(table, "Ann", StatsColumn.Role.PLAYED) == 0
    assert _tally(table, "Ann", StatsColumn.Role.WON) == 0


@pytest.mark.django_db
def test_stripping_leaves_another_tournaments_trophy_alone(table, user):
    """Only the deleted tournament's own credit is taken back."""
    from apps.stats.awarding import strip_tournament_from_board

    first = _tournament(user, squads=[["Ann"], ["Bo"], ["Cal"], ["Dee"]])
    BoardLink.objects.create(tournament=first, table=table)
    _win(first, "Team 1")
    _win(first, "Team 3")
    _win(first, "Team 1")
    first.state = Tournament.State.COMPLETE
    first.save(update_fields=["state"])
    apply_tournament_result(first.stats_link)

    # A second night, won by someone else, on the same board.
    second = _tournament(user, squads=[["Cal"], ["Dee"], ["Ann"], ["Bo"]])
    BoardLink.objects.create(tournament=second, table=table)
    _win(second, "Team 1")
    _win(second, "Team 3")
    _win(second, "Team 1")
    second.state = Tournament.State.COMPLETE
    second.save(update_fields=["state"])
    apply_tournament_result(second.stats_link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 1
    assert _tally(table, "Cal", StatsColumn.Role.TOURNAMENTS_WON) == 1

    # Delete the first: Cal's trophy from the second must survive.
    link = first.stats_link
    link.refresh_from_db()
    strip_tournament_from_board(link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 0
    assert _tally(table, "Cal", StatsColumn.Role.TOURNAMENTS_WON) == 1


@pytest.mark.django_db
def test_stripping_keeps_the_rows(table, user):
    """A player on a board is someone the crew tracks, not one night's residue."""
    from apps.stats.awarding import strip_tournament_from_board

    tournament = _tournament(user, squads=[["Ann"], ["Bo"], ["Cal"], ["Dee"]])
    BoardLink.objects.create(tournament=tournament, table=table)
    _win(tournament, "Team 1")
    sync_tournament_stats(tournament.stats_link)

    before = table.rows.count()
    strip_tournament_from_board(tournament.stats_link)

    assert table.rows.count() == before


@pytest.mark.django_db
def test_deleting_through_the_api_cleans_the_board(auth_client, table, user):
    """The whole path: delete the tournament, board comes back down."""
    tournament = _tournament(user, squads=[["Ann"], ["Bo"], ["Cal"], ["Dee"]])
    BoardLink.objects.create(tournament=tournament, table=table)

    _win(tournament, "Team 1")
    _win(tournament, "Team 3")
    _win(tournament, "Team 1")
    tournament.state = Tournament.State.COMPLETE
    tournament.save(update_fields=["state"])
    sync_tournament_stats(tournament.stats_link)
    apply_tournament_result(tournament.stats_link)

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 1

    response = auth_client.delete(f"/api/v1/tournaments/{tournament.id}/")
    assert response.status_code == 204

    assert _tally(table, "Ann", StatsColumn.Role.TOURNAMENTS_WON) == 0
    assert _tally(table, "Ann", StatsColumn.Role.PLAYED) == 0
    assert not Tournament.objects.filter(pk=tournament.pk).exists()
