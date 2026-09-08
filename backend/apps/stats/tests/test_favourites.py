"""
Pinning boards and tournaments to the top of their lists.

Ordered by *when* they were pinned rather than by a flag, so the list reads in
the order the user chose: the first favourite stays first, and the next sits
below it.
"""

import pytest

from apps.stats.models import StatsBoard
from apps.tournaments.models import Tournament
from apps.tournaments.tests.factories import TournamentFactory

# ── Boards ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_favourited_board_comes_first(auth_client, user):
    StatsBoard.objects.create(name="Alpha", owner=user)
    zulu = StatsBoard.objects.create(name="Zulu", owner=user)

    auth_client.post(f"/api/v1/boards/{zulu.slug}/favourite/")

    names = [row["name"] for row in auth_client.get("/api/v1/boards/").data["results"]]
    assert names == ["Zulu", "Alpha"]


@pytest.mark.django_db
def test_a_second_favourite_sits_below_the_first(auth_client, user):
    boards = {
        name: StatsBoard.objects.create(name=name, owner=user)
        for name in ("Alpha", "Bravo", "Zulu")
    }

    auth_client.post(f"/api/v1/boards/{boards['Zulu'].slug}/favourite/")
    auth_client.post(f"/api/v1/boards/{boards['Bravo'].slug}/favourite/")

    names = [row["name"] for row in auth_client.get("/api/v1/boards/").data["results"]]
    assert names == ["Zulu", "Bravo", "Alpha"]


@pytest.mark.django_db
def test_favouriting_again_unpins_it(auth_client, user):
    StatsBoard.objects.create(name="Alpha", owner=user)
    zulu = StatsBoard.objects.create(name="Zulu", owner=user)

    auth_client.post(f"/api/v1/boards/{zulu.slug}/favourite/")
    response = auth_client.post(f"/api/v1/boards/{zulu.slug}/favourite/")

    assert response.data["favourited_at"] is None
    # Back into the unpinned run, which is newest first.
    names = [row["name"] for row in auth_client.get("/api/v1/boards/").data["results"]]
    assert names == ["Zulu", "Alpha"]


@pytest.mark.django_db
def test_a_stranger_cannot_pin_someone_elses_board(api_client, user, other_user):
    board = StatsBoard.objects.create(name="Alpha", owner=user)
    api_client.force_authenticate(user=other_user)

    response = api_client.post(f"/api/v1/boards/{board.slug}/favourite/")

    assert response.status_code in (400, 403)
    board.refresh_from_db()
    assert board.favourited_at is None


# ── Tournaments ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_a_favourited_tournament_comes_first(auth_client, user):
    TournamentFactory(title="First", created_by=user)
    second = TournamentFactory(title="Second", created_by=user)

    # Newest first by default, so "Second" already leads; pinning "First"
    # is what proves the ordering is doing the work.
    auth_client.post(f"/api/v1/tournaments/{second.id}/favourite/")
    first = Tournament.objects.get(title="First")
    auth_client.post(f"/api/v1/tournaments/{first.id}/favourite/")

    titles = [row["title"] for row in auth_client.get("/api/v1/tournaments/").data["results"]]
    assert titles == ["Second", "First"]


@pytest.mark.django_db
def test_unpinned_tournaments_stay_newest_first(auth_client, user):
    TournamentFactory(title="Older", created_by=user)
    TournamentFactory(title="Newer", created_by=user)
    pinned = TournamentFactory(title="Pinned", created_by=user)

    auth_client.post(f"/api/v1/tournaments/{pinned.id}/favourite/")

    titles = [row["title"] for row in auth_client.get("/api/v1/tournaments/").data["results"]]
    assert titles == ["Pinned", "Newer", "Older"]


@pytest.mark.django_db
def test_unpinned_boards_are_newest_first(auth_client, user):
    # Not alphabetical: the board you just made is the one you are about to
    # open, and a name beginning with Z would have buried it at the bottom.
    for name in ("Alpha", "Bravo", "Zulu"):
        StatsBoard.objects.create(name=name, owner=user)

    names = [row["name"] for row in auth_client.get("/api/v1/boards/").data["results"]]

    assert names == ["Zulu", "Bravo", "Alpha"]


@pytest.mark.django_db
def test_a_pinned_board_still_beats_a_newer_one(auth_client, user):
    alpha = StatsBoard.objects.create(name="Alpha", owner=user)
    StatsBoard.objects.create(name="Zulu", owner=user)

    auth_client.post(f"/api/v1/boards/{alpha.slug}/favourite/")

    names = [row["name"] for row in auth_client.get("/api/v1/boards/").data["results"]]

    assert names == ["Alpha", "Zulu"]
