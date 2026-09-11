"""
Running a night back.

A crew that plays the same tournament every week does not want to retype eight
team names and their rosters each time. Restaging copies the *setup* — the
entrants, their people, the format and its settings — and leaves the results
behind, because the point is to play it again rather than to read it again.

Two things it deliberately does not copy: results, and the award state. A clone
that arrived pre-awarded would hand out a trophy for a bracket nobody has
played.
"""

import re

from django.db import transaction

from .models import Entrant, Participation, Tournament

__all__ = ["next_restage_title", "restage_tournament"]


# A trailing "#12", with the space optional and any amount of trailing
# whitespace tolerated. Anchored to the end so "Match #3 Redemption" keeps its
# name whole — only a number that *ends* the title is the counter.
_NUMBERED = re.compile(r"\s*#\s*(\d+)\s*$")


def base_title(title: str) -> str:
    """The title without its restage counter — "ARAM #4" -> "ARAM"."""
    return _NUMBERED.sub("", title or "").strip()


def next_restage_title(tournament) -> str:
    """
    The clone's name: the same title, with the next number on the end.

    Counted from the **table the tournament feeds**, not from the title string.
    That is what the host means by "the fifth time we have run this": the board
    is the thing that has been accumulating those nights, and it is the only
    place that knows about runs whose titles were edited afterwards.

    An unlinked tournament has no such history to count, so it falls back to the
    number written on its own title. Both paths agree for the ordinary case; the
    table is simply better informed when there is one.
    """
    base = base_title(tournament.title)

    # An untitled bracket gets no counter. "#2" alone names nothing, and the
    # list already distinguishes these by date.
    if not base:
        return ""

    link = getattr(tournament, "stats_link", None)
    table = link.stats_table if link is not None else None

    if table is None:
        current = _NUMBERED.search(tournament.title or "")
        return f"{base} #{int(current.group(1)) + 1 if current else 2}"

    # Every tournament that has ever fed this table under the same base name,
    # including ones since renumbered by hand. Counting rows rather than reading
    # the highest number would repeat a title after a deletion, so the maximum
    # is what the next number follows.
    highest = 1

    for other in Tournament.objects.filter(stats_link__table=table):
        if base_title(other.title).casefold() != base.casefold():
            continue

        found = _NUMBERED.search(other.title or "")
        highest = max(highest, int(found.group(1)) if found else 1)

    return f"{base} #{highest + 1}"


@transaction.atomic
def restage_tournament(tournament, *, user, reshuffle: bool = False):
    """
    Clone `tournament` as a fresh draft and return it.

    The bracket is not generated here. The caller generates it, because seeding
    is the one thing a restage may legitimately want to change — running it back
    with the same matchups, or reshuffling who meets whom in round one.

    The stats link is recreated against the **same table**, not merely the same
    board. A board with a Solo table and a Teams table would otherwise quietly
    move the night onto whichever table the board-level lookup preferred, and
    the crew would find next week's 3v3 results in the solo column.
    """
    from apps.tournaments.views import _link_stats

    clone = Tournament.objects.create(
        title=next_restage_title(tournament),
        description=tournament.description,
        rules=tournament.rules,
        format=tournament.format,
        mode=tournament.mode,
        third_place_match=tournament.third_place_match,
        settings=dict(tournament.settings or {}),
        created_by=user if user.is_authenticated else None,
        # Draft, whatever the original's state: nothing has been played.
        state=Tournament.State.DRAFT,
    )

    _copy_entrants(tournament, clone, reshuffle=reshuffle)
    _copy_roles(tournament, clone)
    _relink_stats(tournament, clone, user)

    return clone


def _copy_entrants(original, clone, *, reshuffle: bool) -> None:
    """
    Recreate the entrant list, with the people attached to each one.

    Players are shared rather than duplicated: they are durable roster entries,
    and a second row for the same person would split their stats in two — the
    thing the Player/Entrant split exists to prevent.

    `seed` is what decides round one. Keeping it reproduces last week's
    matchups exactly; clearing it lets the generator's random seeding pair
    everyone afresh, which is what "reshuffle" means.
    """
    for index, entrant in enumerate(original.entrants.prefetch_related("players"), start=1):
        copy = Entrant.objects.create(
            tournament=clone,
            label=entrant.label,
            seed=None if reshuffle else (entrant.seed or index),
        )

        players = list(entrant.players.all())
        if players:
            copy.players.set(players)

        # Consent travels with the person, not with the night: someone who
        # agreed to be in last week's bracket is in this one too, and the row is
        # what lets them see it and leave it.
        for player in players:
            if player.user_id:
                Participation.objects.get_or_create(entrant=copy, user_id=player.user_id)


def _copy_roles(original, clone) -> None:
    """
    Carry the co-hosts over.

    The same people are in the room. Making the host re-grant reporting rights
    every week is exactly the friction that had them entering every score
    themselves (plan §4, NEW 12).

    The host role is created by the caller's own path, so only co-hosts are
    copied here — and `get_or_create` keeps a host who was also listed from
    being demoted.
    """
    from .models import Role

    for role in original.roles.filter(role=Role.Kind.COHOST):
        Role.objects.get_or_create(
            tournament=clone, user_id=role.user_id, defaults={"role": Role.Kind.COHOST}
        )


def _relink_stats(original, clone, user) -> None:
    """
    Point the clone at the same table the original fed.

    Silently skipped when the original fed nothing, or when the caller can no
    longer write to that board — a restage is not the moment to refuse the whole
    operation over a board somebody lost access to. The clone is still a
    perfectly good bracket; it just is not counted, and the host can link it
    from the bracket page.
    """
    from rest_framework.exceptions import ValidationError

    link = getattr(original, "stats_link", None)
    if link is None:
        return

    # A link made against a single hand-made column is recreated the same way,
    # so a board that only counts "who won the night" keeps counting that.
    table_id = link.table_id
    column_id = link.column_id

    try:
        _link_stats(clone, None, table_id, column_id, user)
    except ValidationError:
        return
