"""Setting up a new tournament: entrants, teams, bracket, co-hosts, drafts."""

import re

from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError

from apps.accounts.models import are_friends
from apps.groups.models import Player

from ..brackets.double_elimination import generate_double_elimination
from ..brackets.round_robin import generate_round_robin
from ..brackets.seeding import seed_entrants
from ..brackets.single_elimination import generate_single_elimination
from ..brackets.swiss import generate_swiss
from ..models import Entrant, Participation, Role, Tournament

UNTITLED_BASE = "Untitled Tournament"
# "Untitled Tournament 4", with the number at the very end. Anchored so a
# tournament somebody renamed to "Untitled Tournament 4 Redemption" is not
# mistaken for a counter.
_UNTITLED_NUMBER = re.compile(rf"^{re.escape(UNTITLED_BASE)}\s*(\d+)\s*$", re.IGNORECASE)


def create_entrants(tournament, labels, user=None):
    """
    Create entrants from a pasted list of names.

    In solo mode an entrant *is* a person, so each name is attached as a Player
    the same way a team's members are. Without that a linked stats board has
    nobody to track: it counts by player, and a bracket of bare labels has none
    — which showed up as a board that stayed empty all night.

    An anonymous host has no roster to attach to, so their entrants stay labels.
    That is the trade the no-account path makes.
    """
    created = []

    for index, label in enumerate(labels, start=1):
        label = str(label).strip()
        if not label:
            continue

        entrant = Entrant.objects.create(tournament=tournament, label=label, seed=index)
        created.append(entrant)

        if user is not None and user.is_authenticated:
            entrant.players.add(player_named(user, label))
            link_participants(entrant)

    return created


def player_named(user, name):
    """This host's roster entry for `name`, created if they have none."""
    # Case-insensitive match, then create. get_or_create cannot be used with an
    # __iexact lookup: it would pass that through to the model constructor on
    # the create branch and raise.
    player = Player.objects.filter(owner=user, display_name__iexact=name).first()
    if player is None:
        player = Player.objects.create(owner=user, display_name=name)

    return player


def create_team_entrants(tournament, teams, user):
    """
    Create entrants that are squads, attaching each member as a Player.

    Members are matched against the host's existing roster by name before a new
    Player is created, so sending the same crew to a second bracket links to the
    people already there rather than duplicating them — which would split one
    person's stats across two rows.

    For an anonymous host there is no roster to attach to, so the team is stored
    as a label alone and its members are lost. That is the trade the no-account
    path makes: nothing to own the Player rows.
    """
    created = []

    for index, team in enumerate(teams, start=1):
        entrant = Entrant.objects.create(
            tournament=tournament, label=str(team["label"]).strip(), seed=index
        )
        created.append(entrant)

        if not user.is_authenticated:
            continue

        for name in team.get("members") or []:
            name = str(name).strip()
            if not name:
                continue

            entrant.players.add(player_named(user, name))

        link_participants(entrant)

    return created


def generate_bracket(tournament, seeding="random"):
    """Dispatch to the right generator for this tournament's format."""
    entrants = seed_entrants(list(tournament.entrants.all()), seeding)

    if len(entrants) < 2:
        raise ValidationError("A tournament needs at least two entrants.")

    fmt = tournament.format

    if fmt == Tournament.Format.SINGLE:
        generate_single_elimination(tournament, entrants, third_place=tournament.third_place_match)
    elif fmt == Tournament.Format.DOUBLE:
        generate_double_elimination(tournament, entrants, third_place=tournament.third_place_match)
    elif fmt == Tournament.Format.ROUND_ROBIN:
        generate_round_robin(
            tournament,
            entrants,
            double_round=bool((tournament.settings or {}).get("double_round")),
        )
    elif fmt == Tournament.Format.SWISS:
        generate_swiss(tournament, entrants)

    # Re-seed in the order actually used, so the bracket and the entrant list
    # agree about who is seed 1.
    for index, entrant in enumerate(entrants, start=1):
        entrant.seed = index
    Entrant.objects.bulk_update(entrants, ["seed"])


def link_participants(entrant):
    """
    Create Participation rows for entrants backed by a real account.

    This is what lets a player see events they have been added to and leave one
    (plan §8) — consent recorded from the start rather than retrofitted.
    """
    for player in entrant.players.all():
        if player.user_id:
            Participation.objects.get_or_create(entrant=entrant, user_id=player.user_id)


def add_cohosts(tournament, user_ids, host):
    """
    Give a few friends reporting rights as the bracket is created.

    Doing it here rather than only afterwards is the difference between the host
    being the sole bottleneck for entering scores all night and not (plan §4,
    NEW 12) — by the time the first match ends, nobody wants to be in a settings
    screen.

    Anyone who is not the host's friend is skipped rather than failing the whole
    creation: losing a bracket because one name in a list was stale would be a
    poor trade.
    """
    if not user_ids or not host.is_authenticated:
        return

    people = get_user_model().objects.filter(pk__in=user_ids)

    for person in people:
        if person.id == host.id or not are_friends(host, person):
            continue

        Role.objects.get_or_create(
            tournament=tournament, user=person, defaults={"role": Role.Kind.COHOST}
        )


def next_untitled_title(user) -> str:
    """
    The default name for a tournament created without one.

    Counted per account rather than globally: the number exists so a host can
    tell their own untitled nights apart in their own list, and a global counter
    would jump unpredictably as strangers created brackets.

    Taken from the **highest number already in use**, not from how many exist.
    Counting rows reuses a number after a deletion — delete #2 of three and the
    next one is also #3 — which is exactly the collision this is meant to
    prevent. The same reasoning `next_restage_title` documents.

    An anonymous quick-start bracket has no account to scope a count to, and
    nobody has a list of them to disambiguate, so it keeps the bare base name.
    """
    if not getattr(user, "is_authenticated", False):
        return UNTITLED_BASE

    highest = 0
    for title in Tournament.objects.filter(
        created_by=user, title__istartswith=UNTITLED_BASE
    ).values_list("title", flat=True):
        found = _UNTITLED_NUMBER.match((title or "").strip())
        if found:
            highest = max(highest, int(found.group(1)))
        else:
            # A bare "Untitled Tournament" with no number is the first one.
            highest = max(highest, 1)

    return f"{UNTITLED_BASE} {highest + 1}"


def open_team_draft(tournament, labels, config, user):
    """
    Turn a pool of names into an open draft instead of a bracket.

    Called from `create` when the request carries `settings.team_draft`. The
    tournament is left with no entrants at all: they are created when the draft
    completes, from the teams it produced. That ordering is what keeps every
    format working — the generator receives a normal entrant list and never
    learns a draft happened.

    The pool is stashed on `settings.draft_pool` rather than in its own table.
    It is a list of strings that never changes once the draft opens — picks are
    what move, and those are rows — so a table would buy integrity over nothing.
    """
    from ..models import DraftTeam, TeamDraft
    from .drafting import DraftError, assign_captains, build_pick_order

    team_count = int(config.get("team_count") or 0)
    chosen = config.get("captains") or None

    try:
        captains, pool = assign_captains(labels, team_count, chosen=chosen)
        pick_order = build_pick_order(team_count, len(pool))
    except DraftError as error:
        raise ValidationError(str(error)) from error

    tournament.state = Tournament.State.DRAFTING
    tournament.settings = {**(tournament.settings or {}), "draft_pool": pool}
    tournament.save(update_fields=["state", "settings", "updated_at"])

    # Pool names are resolved to roster entries the same way captains are, so a
    # friend waiting to be picked can watch the lobby from their own device.
    # Only accounts are recorded — a name with no roster link behind it yields
    # nothing, which is the anonymous case and stays invisible.
    pool_user_ids = []
    if user is not None and user.is_authenticated:
        for name in pool:
            linked = player_named(user, name).user_id
            if linked is not None and linked not in pool_user_ids:
                pool_user_ids.append(linked)

    draft = TeamDraft.objects.create(
        tournament=tournament,
        team_count=team_count,
        captain_mode=(TeamDraft.CaptainMode.MANUAL if chosen else TeamDraft.CaptainMode.RANDOM),
        pick_order=pick_order,
        pool_user_ids=pool_user_ids,
    )

    for position, captain_label in enumerate(captains):
        player = None
        captain_user_id = None

        # A captain who is a linked account is recorded now. Nothing local reads
        # it — the host taps every pick — but live drafting needs it to hand
        # that person their own turn, and retrofitting it later means reshaping
        # rows that already exist.
        if user is not None and user.is_authenticated:
            player = player_named(user, captain_label)
            captain_user_id = player.user_id

        DraftTeam.objects.create(
            draft=draft,
            position=position,
            captain=player,
            captain_label=captain_label,
            captain_user_id=captain_user_id,
        )

    return draft
