"""
The captain-draft phase: turning a pool of names into teams, one pick at a time.

This module is deliberately pure — it computes orders and validates picks, and
does not touch the database. The view layer owns persistence. That split is what
makes the tricky part (pick order, uneven pools, whose turn it is) testable
without fixtures, which matters here for the same reason it matters for the
bracket generators: an order that looks plausible and is subtly wrong destroys
trust the first time a group notices (plan §8).

The draft produces `[{"label": ..., "members": [...]}]` — exactly the shape
`_create_team_entrants` already consumes. Nothing downstream needs to know a
draft happened, which is why every tournament format works with captains for
free.
"""

import random

__all__ = [
    "DraftError",
    "assign_captains",
    "build_pick_order",
    "picks_per_team",
    "teams_payload",
    "total_picks",
]


class DraftError(Exception):
    """A draft could not be set up or advanced. Surfaced as a 400."""


def assign_captains(names, team_count, chosen=None, rng=None):
    """
    Split `names` into (captains, pool).

    `chosen` names the captains explicitly; without it they are drawn at random.
    Either way the captains come *out* of the pool — a captain who could also be
    picked would end up on two teams, which is the obvious bug here and worth
    making structurally impossible rather than validating against.

    `rng` is injectable so tests are deterministic, matching `seed_entrants`.
    """
    cleaned = [str(name).strip() for name in names]
    cleaned = [name for name in cleaned if name]

    if len({name.lower() for name in cleaned}) != len(cleaned):
        raise DraftError("Two players share a name. Every name must be distinct to draft.")

    if team_count < 2:
        raise DraftError("A draft needs at least two teams.")

    if len(cleaned) < team_count:
        raise DraftError(
            f"{len(cleaned)} players cannot fill {team_count} teams — "
            "there must be at least one captain per team."
        )

    if chosen:
        wanted = [str(name).strip() for name in chosen if str(name).strip()]

        if len(wanted) != team_count:
            raise DraftError(f"Pick exactly {team_count} captains, one per team.")

        by_lower = {name.lower(): name for name in cleaned}
        captains = []
        for name in wanted:
            actual = by_lower.get(name.lower())
            if actual is None:
                raise DraftError(f"{name} is not in the player list.")
            if actual in captains:
                raise DraftError(f"{actual} cannot captain two teams.")
            captains.append(actual)
    else:
        captains = list((rng or random).sample(cleaned, team_count))

    taken = {name.lower() for name in captains}
    pool = [name for name in cleaned if name.lower() not in taken]

    return captains, pool


def build_pick_order(team_count, pool_size, rng=None):
    """
    The order teams pick in, as team indexes, for the whole draft.

    Two rules, and the second is the one that was asked for explicitly:

      - The teams' *starting* order is randomised, so being listed first is not
        an advantage handed out by the order somebody typed names in.
      - From there it cycles: every team picks once before anyone picks twice,
        then it comes back around. Straight rotation rather than a snake, which
        is what "starts from the first listed team then 2nd and so on, then
        comes back around" describes.

    The order is truncated to the pool size, so an uneven pool simply runs out
    mid-cycle and the teams late in the rotation finish one player short. That
    is the documented behaviour for 11 players across 4 teams: 3/3/3/2.
    """
    if team_count < 2:
        raise DraftError("A draft needs at least two teams.")

    rotation = list(range(team_count))
    (rng or random).shuffle(rotation)

    order = []
    while len(order) < pool_size:
        order.extend(rotation)

    return order[:pool_size]


def total_picks(pool_size):
    """Every player in the pool gets picked exactly once."""
    return pool_size


def picks_per_team(team_count, pool_size):
    """
    How many picks each team ends up with, indexed by team.

    Returned for the UI's benefit — a host should be able to see up front that
    one team will be a player short, rather than discovering it at the last
    pick.
    """
    if team_count < 2:
        raise DraftError("A draft needs at least two teams.")

    base, remainder = divmod(pool_size, team_count)
    return [base + (1 if index < remainder else 0) for index in range(team_count)]


def teams_payload(captains, picks_by_team, labels=None):
    """
    The finished draft, in the shape `_create_team_entrants` already takes.

    The captain leads their own team's member list: they are on the team, and
    putting them first is what makes the bracket card read the way the group
    thinks about it ("Ada's team: Ada, Grace, Alan").
    """
    payload = []

    for index, captain in enumerate(captains):
        members = [captain, *picks_by_team.get(index, [])]
        label = None

        if labels:
            label = str(labels[index]).strip() if index < len(labels) else None

        payload.append({"label": label or f"{captain}'s team", "members": members})

    return payload
