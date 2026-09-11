"""
The chain a friend travels: roster -> event -> their own profile.

Adding a friend puts them on your saved roster with their account attached
(`apps.accounts.models.sync_roster_entry`). From there, dropping their name into
a team generator, a tournament or a stats board should reach the *account*, not
just the string — which is what makes the event show up for them as well as for
the host.

The join is by name: entrants are created from typed labels, and `_player_named`
resolves each one against the host's roster. That works only because a friend's
roster row keeps its `display_name` in step with their account, so these tests
cover the seams where that could come apart — a different case, and a namesake
who is nobody's friend.
"""

import pytest

from apps.accounts.models import Friendship, sync_roster_entry
from apps.groups.models import Player
from apps.stats.awarding import ensure_automatic_columns
from apps.stats.models import BoardLink, StatsBoard
from apps.tournaments.models import Participation, Tournament


@pytest.fixture
def friend(user, other_user):
    """`other_user`, befriended and therefore on `user`'s roster."""
    Friendship.objects.create(from_user=user, to_user=other_user, status=Friendship.Status.ACCEPTED)
    sync_roster_entry(user, other_user)
    return other_user


def make_tournament(client, members, **extra):
    response = client.post(
        "/api/v1/tournaments/",
        {
            "format": "single",
            "entrant_teams": [
                {"label": "A", "members": members},
                {"label": "B", "members": ["Someone Else"]},
            ],
            **extra,
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    return Tournament.objects.get(pk=response.data["id"])


@pytest.mark.django_db
def test_a_friend_dropped_into_a_bracket_is_linked_to_their_account(auth_client, user, friend):
    # The whole point: the host types a name, and the person behind it is
    # attached — not a fresh string that happens to match.
    tournament = make_tournament(auth_client, [friend.name])

    assert Participation.objects.filter(user=friend, entrant__tournament=tournament).exists()


@pytest.mark.django_db
def test_the_event_appears_in_the_friends_own_list(api_client, auth_client, user, friend):
    # `get_queryset` includes entrants__participations__user, so an event you
    # were added to is one you can see — which is what makes this worth doing
    # rather than just storing a name.
    tournament = make_tournament(auth_client, [friend.name])

    api_client.force_authenticate(user=friend)
    listed = api_client.get("/api/v1/tournaments/").data["results"]

    assert tournament.id in [row["id"] for row in listed]


@pytest.mark.django_db
def test_the_host_gains_no_duplicate_roster_row(auth_client, user, friend):
    # `_player_named` should find the friend's existing entry rather than
    # creating a second one beside it.
    make_tournament(auth_client, [friend.name])

    assert Player.objects.filter(owner=user, display_name__iexact=friend.name).count() == 1


@pytest.mark.django_db
def test_the_match_survives_a_difference_in_case(auth_client, user, friend):
    # Hosts type from memory. A case-sensitive match here would quietly create a
    # second, unlinked roster entry and the friend would never see the event.
    make_tournament(auth_client, [friend.name.upper()])

    assert Participation.objects.filter(user=friend).exists()
    assert Player.objects.filter(owner=user, user=friend).count() == 1


@pytest.mark.django_db
def test_a_friend_reaches_a_linked_stats_board(auth_client, user, friend):
    board = StatsBoard.objects.create(name="League", owner=user)
    ensure_automatic_columns(board.tables.create(name="Tournaments", position=0))

    tournament = make_tournament(auth_client, [friend.name], stats_board=board.slug)

    link = BoardLink.objects.get(tournament=tournament)
    rows = {row.display_name for row in link.stats_table.rows.all()}

    assert friend.name in rows


@pytest.mark.django_db
def test_a_namesake_who_is_not_a_friend_is_not_attached(auth_client, user, friend):
    # A name is not an identity. Somebody typed by hand who merely shares a
    # friend's name must not inherit their account — that would attach results
    # to a person who never played.
    Player.objects.filter(owner=user, user=friend).delete()
    Player.objects.create(owner=user, display_name=friend.name)

    make_tournament(auth_client, [friend.name])

    assert not Participation.objects.filter(user=friend).exists()
