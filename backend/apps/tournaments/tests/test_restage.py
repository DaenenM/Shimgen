"""
Running a night back.

The crew plays the same tournament every week. Restaging copies the setup —
entrants, their people, the format, the board it feeds — and leaves the results
behind, so the record of what already happened survives.

The numbering is the part worth pinning down: the counter comes from the table
the tournament feeds, because that is where the history of "how many times have
we run this" actually lives.
"""

import pytest
from django.urls import reverse

from apps.groups.models import Player
from apps.stats.models import BoardLink, StatsBoard, StatsColumn
from apps.tournaments.models import Tournament

pytestmark = pytest.mark.django_db

CREATE = "/api/v1/tournaments/"


def restage_url(tournament_id):
    return reverse("v1:tournaments:tournament-restage", args=[tournament_id])


@pytest.fixture
def board(user):
    """A board with two tables, which is the case that needs a real choice."""
    board = StatsBoard.objects.create(name="Pummel Party", owner=user)
    solo = board.tables.create(name="Solo wins", position=0)
    teams = board.tables.create(name="Team wins", position=1)

    for table in (solo, teams):
        from apps.stats.awarding import ensure_automatic_columns

        ensure_automatic_columns(table)

    return board


@pytest.fixture
def played(auth_client, board):
    """A finished tournament feeding the Solo table."""
    solo = board.tables.get(name="Solo wins")

    created = auth_client.post(
        CREATE,
        {
            "title": "ARAM 3v3 Tourney",
            "format": "single",
            "entrant_labels": ["Ann", "Ben"],
            "stats_table": solo.id,
        },
        format="json",
    ).json()

    return Tournament.objects.get(pk=created["id"])


# ── Naming ────────────────────────────────────────────────────────────────────


def test_the_first_restage_becomes_number_two(auth_client, played):
    response = auth_client.post(restage_url(played.id), {}, format="json")

    assert response.status_code == 201
    assert response.json()["title"] == "ARAM 3v3 Tourney #2"


def test_the_number_climbs_with_each_run(auth_client, played):
    """Five nights played means the next one is #6, not #2 again."""
    current = played

    for expected in ("#2", "#3", "#4", "#5"):
        body = auth_client.post(restage_url(current.id), {}, format="json").json()
        assert body["title"] == f"ARAM 3v3 Tourney {expected}"
        current = Tournament.objects.get(pk=body["id"])


def test_restaging_an_older_run_still_continues_the_series(auth_client, played):
    """
    The counter follows the table, not the tournament it was cloned from.

    Running back the *original* after four more nights must not produce a second
    "#2" — the board already knows how far the series has got.
    """
    current = played
    for _ in range(3):
        body = auth_client.post(restage_url(current.id), {}, format="json").json()
        current = Tournament.objects.get(pk=body["id"])

    # Back to the very first one.
    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    assert body["title"] == "ARAM 3v3 Tourney #5"


def test_an_unlinked_tournament_counts_from_its_own_title(auth_client):
    created = auth_client.post(
        CREATE,
        {"title": "Kitchen Cup #7", "format": "single", "entrant_labels": ["A", "B"]},
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()

    assert body["title"] == "Kitchen Cup #8"


def test_an_untitled_bracket_gets_no_counter(auth_client):
    """ "#2" on its own names nothing, and the list already sorts by date."""
    created = auth_client.post(
        CREATE, {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()

    assert body["title"] == ""


def test_a_hash_mid_title_is_left_alone(auth_client):
    """Only a number ending the title is the counter."""
    created = auth_client.post(
        CREATE,
        {"title": "Match #3 Redemption", "format": "single", "entrant_labels": ["A", "B"]},
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()

    assert body["title"] == "Match #3 Redemption #2"


# ── What is copied ────────────────────────────────────────────────────────────


def test_the_entrants_come_across(auth_client, played):
    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    assert sorted(e["label"] for e in body["entrants"]) == ["Ann", "Ben"]


def test_the_people_behind_the_entrants_are_shared_not_duplicated(auth_client, played, user):
    """
    A second Player row for the same person splits their stats in two — the
    thing the Player/Entrant split exists to prevent.
    """
    before = Player.objects.filter(owner=user).count()

    auth_client.post(restage_url(played.id), {}, format="json")

    assert Player.objects.filter(owner=user).count() == before


def test_team_rosters_survive_the_clone(auth_client, user):
    created = auth_client.post(
        CREATE,
        {
            "title": "Squads",
            "format": "single",
            "entrant_teams": [
                {"label": "Blue Shells", "members": ["Ann", "Ben"]},
                {"label": "Red Turtles", "members": ["Cal", "Dee"]},
            ],
        },
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()
    entrants = {e["label"]: e for e in body["entrants"]}

    assert sorted(p["display_name"] for p in entrants["Blue Shells"]["players"]) == ["Ann", "Ben"]
    assert sorted(p["display_name"] for p in entrants["Red Turtles"]["players"]) == ["Cal", "Dee"]


def test_the_clone_starts_empty_and_in_draft(auth_client, played):
    """The point is to play it again, not to read last week's results."""
    match = played.matches.filter(a__isnull=False, b__isnull=False).first()
    auth_client.post(
        reverse("v1:tournaments:match-report", args=[match.id]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    assert body["state"] == "draft"
    assert [m for m in body["matches"] if m["winner"]] == []


def test_the_original_is_untouched(auth_client, played):
    match = played.matches.filter(a__isnull=False, b__isnull=False).first()
    auth_client.post(
        reverse("v1:tournaments:match-report", args=[match.id]),
        {"score_a": 1, "score_b": 0},
        format="json",
    )

    auth_client.post(restage_url(played.id), {}, format="json")

    played.refresh_from_db()
    assert played.state == Tournament.State.COMPLETE
    assert played.matches.filter(winner__isnull=False).exists()


def test_the_format_and_its_settings_carry_over(auth_client):
    created = auth_client.post(
        CREATE,
        {
            "title": "Doubles",
            "format": "double",
            "entrant_labels": ["A", "B", "C", "D"],
            "settings": {"best_of": {"default": 3}, "bracket_reset": True},
        },
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()

    assert body["format"] == "double"
    assert body["settings"]["bracket_reset"] is True
    assert body["settings"]["best_of"]["default"] == 3


# ── The board link ────────────────────────────────────────────────────────────


def test_the_clone_feeds_the_same_table(auth_client, played, board):
    """
    The same *table*, not merely the same board.

    A board with Solo and Teams tables would otherwise move the night onto
    whichever one a board-level lookup preferred, and next week's 3v3 results
    would turn up in the solo column.
    """
    solo = board.tables.get(name="Solo wins")

    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    link = BoardLink.objects.get(tournament_id=body["id"])
    assert link.stats_table.id == solo.id


def test_the_clone_arrives_unawarded(auth_client, played):
    """A clone that arrived pre-awarded would hand out a trophy for a bracket
    nobody has played."""
    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    link = BoardLink.objects.get(tournament_id=body["id"])
    assert link.awarded is False
    assert link.awarded_player_ids == []


def test_a_link_to_a_single_column_is_recreated_the_same_way(auth_client, user):
    """A board that only counts "who won the night" keeps counting that."""
    board = StatsBoard.objects.create(name="Hand counted", owner=user)
    table = board.tables.create(name="Wins", position=0)
    column = table.columns.create(name="Nights won", position=0, role=StatsColumn.Role.MANUAL)

    created = auth_client.post(
        CREATE,
        {
            "title": "Bar Night",
            "format": "single",
            "entrant_labels": ["A", "B"],
            "stats_column": column.id,
        },
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()

    link = BoardLink.objects.get(tournament_id=body["id"])
    assert link.column_id == column.id


def test_an_unlinked_tournament_stays_unlinked(auth_client):
    created = auth_client.post(
        CREATE,
        {"title": "Casual", "format": "single", "entrant_labels": ["A", "B"]},
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()

    assert not BoardLink.objects.filter(tournament_id=body["id"]).exists()


# ── Reshuffling ───────────────────────────────────────────────────────────────


def test_running_it_back_keeps_the_matchups(auth_client):
    """Without a reshuffle, round one is the same fixtures as last time."""
    created = auth_client.post(
        CREATE,
        {"title": "Same again", "format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    original = {
        (m["round_no"], m["position"]): (m["a_label"], m["b_label"])
        for m in created["matches"]
        if m["a_label"] and m["b_label"]
    }

    body = auth_client.post(restage_url(created["id"]), {}, format="json").json()
    clone = {
        (m["round_no"], m["position"]): (m["a_label"], m["b_label"])
        for m in body["matches"]
        if m["a_label"] and m["b_label"]
    }

    assert clone == original


def test_reshuffling_still_produces_a_full_bracket(auth_client):
    """
    Reshuffled pairings are random, so the fixtures are not asserted — only that
    everybody is still in it exactly once.
    """
    created = auth_client.post(
        CREATE,
        {"title": "Shuffled", "format": "single", "entrant_labels": ["A", "B", "C", "D"]},
        format="json",
    ).json()

    body = auth_client.post(restage_url(created["id"]), {"reshuffle": True}, format="json").json()

    assert sorted(e["label"] for e in body["entrants"]) == ["A", "B", "C", "D"]

    seated = [m["a_label"] for m in body["matches"] if m["a_label"]]
    seated += [m["b_label"] for m in body["matches"] if m["b_label"]]
    assert sorted(seated) == ["A", "B", "C", "D"]


# ── Permissions ───────────────────────────────────────────────────────────────


def test_a_stranger_cannot_run_someone_elses_tournament_back(api_client, played, other_user):
    api_client.force_authenticate(user=other_user)
    response = api_client.post(restage_url(played.id), {}, format="json")

    assert response.status_code in (403, 404)


def test_restaging_needs_an_account(api_client):
    """The clone has to be owned by somebody, and an anonymous caller is not."""
    created = api_client.post(
        CREATE, {"format": "single", "entrant_labels": ["A", "B"]}, format="json"
    ).json()

    response = api_client.post(restage_url(created["id"]), {}, format="json")

    assert response.status_code in (401, 403)


def test_the_clone_appears_in_the_hosts_list(auth_client, played):
    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    listed = auth_client.get(CREATE).json()
    rows = listed.get("results", listed)

    assert body["id"] in [row["id"] for row in rows]


def test_cohosts_come_across(auth_client, played, user, other_user):
    """The same people are in the room; re-granting every week is the friction
    co-hosts exist to remove."""
    from apps.accounts.models import Friendship
    from apps.tournaments.models import Role

    Friendship.objects.create(from_user=user, to_user=other_user, status=Friendship.Status.ACCEPTED)
    Role.objects.create(tournament=played, user=other_user, role=Role.Kind.COHOST)

    body = auth_client.post(restage_url(played.id), {}, format="json").json()

    assert Role.objects.filter(
        tournament_id=body["id"], user=other_user, role=Role.Kind.COHOST
    ).exists()
