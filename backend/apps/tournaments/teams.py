"""
Team generation.

Randomise, validate against the constraints, retry. For groups under ~30 that is
instant and needs no real constraint solver (plan §3) — a few thousand attempts
covers any realistic game night, and the retry loop is far easier to reason
about than a solver when someone asks why two people ended up together.

Constraints:
  - APART     these two must not share a team
  - TOGETHER  these two must share a team (couples, carpools)
  - LOCKED    this player is pinned to a specific team index

Balancing:
  - random    pure shuffle
  - rating    minimise the spread of mean team Elo, so teams are fair

`avoid_previous` additionally rejects an arrangement identical to last week's,
which is the difference between a randomiser that feels random and one that
keeps producing the same three people together.
"""

import random
from dataclasses import dataclass

__all__ = ["TeamGenerationError", "generate_teams"]

# Enough attempts to satisfy any realistic constraint set; past this the
# constraints are almost certainly contradictory rather than merely tight.
MAX_ATTEMPTS = 5000


class TeamGenerationError(Exception):
    """No arrangement satisfies the constraints."""


@dataclass
class Constraint:
    """A rule, decoupled from the model so this module stays testable."""

    kind: str  # together | apart | locked
    player_ids: list[int]
    team_index: int | None = None

    # An APART rule written about names rather than individuals has sides: two
    # people can share a name, and "keep Alex and Bob apart" must hold for every
    # Alex without also splitting the two Alexes from each other. When set, each
    # entry is one side of the rule; `player_ids` stays the flat membership so
    # the impossibility checks keep working unchanged.
    groups: list[list[int]] | None = None


def generate_teams(
    players,
    team_count: int,
    *,
    constraints=None,
    balance: str = "random",
    ratings: dict | None = None,
    avoid: list[list[int]] | None = None,
    rng=None,
):
    """
    Split `players` into `team_count` teams.

    `players` is any sequence of objects with an `id`. Returns a list of lists.

    `ratings` maps player id -> Elo and is required for balance="rating".
    `avoid` is a previous arrangement (list of id lists) not to reproduce.
    `rng` is injectable so tests are deterministic.
    """
    if team_count < 1:
        raise TeamGenerationError("At least one team is required.")
    if len(players) < team_count:
        raise TeamGenerationError(f"{len(players)} players cannot fill {team_count} teams.")

    rng = rng or random
    rules = _normalise(constraints or [])
    _reject_impossible(rules, players, team_count)

    best = None
    best_spread = float("inf")

    for _ in range(MAX_ATTEMPTS):
        teams = _attempt(players, team_count, rules, rng)
        if teams is None:
            continue

        if avoid and _same_arrangement(teams, avoid):
            continue

        if balance != "rating":
            return teams

        # Keep searching for a fairer split, but hold on to the best so far so
        # a tight constraint set still returns something.
        spread = _rating_spread(teams, ratings or {})
        if spread < best_spread:
            best, best_spread = teams, spread
            if spread == 0:
                break

    if best is not None:
        return best

    raise TeamGenerationError(
        "No arrangement satisfies these constraints. Check for a player who must "
        "be both with and apart from the same person."
    )


def _normalise(constraints) -> list[Constraint]:
    """Accept either Constraint objects or the model rows."""
    rules = []
    for item in constraints:
        if isinstance(item, Constraint):
            rules.append(item)
        else:
            rules.append(
                Constraint(
                    kind=item.kind,
                    player_ids=[p.id for p in item.players.all()],
                    team_index=item.team_index,
                )
            )
    return rules


def _reject_impossible(rules, players, team_count):
    """
    Catch contradictions before burning 5000 attempts on them.

    The common one is a pair that is both TOGETHER and APART, usually because a
    group-level rule was added twice with different intent. Failing fast gives a
    useful message instead of a generic timeout.
    """
    together = {frozenset(r.player_ids) for r in rules if r.kind == "together"}
    apart = {frozenset(r.player_ids) for r in rules if r.kind == "apart"}

    clash = together & apart
    if clash:
        raise TeamGenerationError(
            "A pair is marked both together and apart; remove one of the rules."
        )

    # A TOGETHER group larger than a team can hold can never be placed.
    largest = max((len(r.player_ids) for r in rules if r.kind == "together"), default=0)
    capacity = -(-len(players) // team_count)  # ceiling division
    if largest > capacity:
        raise TeamGenerationError(
            f"A group of {largest} players cannot fit in a team of at most {capacity}."
        )


def _attempt(players, team_count, rules, rng):
    """One randomised arrangement, or None if it breaks a constraint."""
    teams = [[] for _ in range(team_count)]
    placed = {}

    # Locked players first — they have no freedom, and placing them last would
    # waste attempts that were doomed from the start.
    for rule in rules:
        if rule.kind != "locked" or rule.team_index is None:
            continue
        index = rule.team_index % team_count
        for pid in rule.player_ids:
            placed[pid] = index

    pool = [p for p in players if p.id not in placed]
    rng.shuffle(pool)

    # Then TOGETHER groups, as units.
    groups = _together_groups(rules)
    units = []
    seen = set()

    for group in groups:
        members = [p for p in pool if p.id in group]
        if members:
            units.append(members)
            seen.update(m.id for m in members)

    units += [[p] for p in pool if p.id not in seen]
    rng.shuffle(units)

    # Seat each unit in the smallest team, so sizes stay even.
    for unit in units:
        target = min(range(team_count), key=lambda i: len(teams[i]))
        teams[target].extend(unit)

    for pid, index in placed.items():
        player = next(p for p in players if p.id == pid)
        teams[index].append(player)

    return teams if _satisfies(teams, rules) else None


def _together_groups(rules) -> list[set]:
    """
    Merge overlapping TOGETHER rules into connected groups.

    "A with B" and "B with C" means all three share a team, which is only
    correct if the rules are unioned rather than applied pairwise.
    """
    groups: list[set] = []

    for rule in rules:
        if rule.kind != "together":
            continue

        ids = set(rule.player_ids)
        overlapping = [g for g in groups if g & ids]

        for g in overlapping:
            ids |= g
            groups.remove(g)

        groups.append(ids)

    return groups


def _satisfies(teams, rules) -> bool:
    """Check an arrangement against every rule."""
    location = {p.id: index for index, team in enumerate(teams) for p in team}

    for rule in rules:
        present = [pid for pid in rule.player_ids if pid in location]

        if rule.kind == "apart":
            if rule.groups:
                # Sided rule: no team may hold members of two different sides.
                # Two people sharing a side (two Alexes) may still sit together.
                seats = [{location[pid] for pid in side if pid in location} for side in rule.groups]
                if any(a & b for i, a in enumerate(seats) for b in seats[i + 1 :]):
                    return False
            else:
                spots = [location[pid] for pid in present]
                if len(spots) != len(set(spots)):
                    return False

        elif rule.kind == "together":
            spots = {location[pid] for pid in present}
            if len(spots) > 1:
                return False

        elif rule.kind == "locked" and rule.team_index is not None:
            target = rule.team_index % len(teams)
            if any(location[pid] != target for pid in present):
                return False

    return True


def _rating_spread(teams, ratings: dict) -> float:
    """
    Difference between the strongest and weakest team's mean rating.

    Mean rather than total, so uneven team sizes are compared fairly — a 3v2
    split should not label the larger team stronger by default.
    """
    means = []
    for team in teams:
        if not team:
            continue
        means.append(sum(ratings.get(p.id, 1200) for p in team) / len(team))

    return max(means) - min(means) if means else 0.0


def _same_arrangement(teams, previous) -> bool:
    """
    True if `teams` is last week's split again, ignoring team order.

    Compared as a set of frozensets so "team 1 and team 2 swapped places" counts
    as the same arrangement — which it is, to the people playing.
    """
    current = {frozenset(p.id for p in team) for team in teams if team}
    prior = {frozenset(team) for team in previous if team}

    return current == prior


def split_evenly(total: int, teams: int) -> list[int]:
    """
    Team sizes for `total` players, as even as possible.

    Returns e.g. [3, 3, 2] for 8 players in 3 teams — the "who plays 2v3"
    question from plan §3, answered explicitly rather than left to chance.
    """
    base, extra = divmod(total, teams)
    return [base + 1] * extra + [base] * (teams - extra)
