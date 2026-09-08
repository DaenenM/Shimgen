"""
Free-for-all.

Lobbies of N entrants, several rounds, points by finishing position. The plan
calls this the one Pummel Party actually needs, and the one almost nothing
supports well (plan §3).

The shape does not fit Match's a/b sides: a lobby of six produces six
placements, not a winner and a loser. So a Match row represents the *lobby*, and
FFAResult rows carry the finishing order. `Match.winner` is still set — to
whoever placed first — so the rest of the system (stats, "who won", the match
list) needs no special case.

Settings:

    {"ffa": {"lobby_size": 4,
             "rounds": 3,
             "points": [10, 6, 3, 1],   # by placement, first to last
             "advance": 2}}             # top N per lobby carry into the next round
"""

from ..models import FFAResult, Match
from .best_of import best_of_for

__all__ = ["DEFAULT_FFA", "generate_ffa", "next_ffa_round", "report_ffa_result"]

DEFAULT_FFA = {"lobby_size": 4, "rounds": 1, "points": [], "advance": 0}


def ffa_settings(tournament) -> dict:
    return {**DEFAULT_FFA, **((tournament.settings or {}).get("ffa") or {})}


def points_for(config: dict, placement: int, lobby_size: int) -> float:
    """
    Points for finishing `placement` in a lobby.

    An explicit points table wins. Otherwise the default is linear and depends
    on lobby size — first in a six-player lobby beats first in a three-player
    one, which is the behaviour people expect.
    """
    table = config.get("points") or []
    if placement <= len(table):
        return float(table[placement - 1])

    # Linear fallback: first in a lobby of n scores n-1, last scores 0. Scaling
    # with lobby size means winning a six-player game is worth more than winning
    # a three-player one, which is what people expect when lobbies are uneven.
    return float(max(lobby_size - placement, 0))


def generate_ffa(tournament, entrants):
    """Create round one's lobbies."""
    if len(entrants) < 2:
        raise ValueError("A free-for-all needs at least two entrants.")

    config = ffa_settings(tournament)
    _create_lobbies(tournament, 1, list(entrants), config)

    return Match.objects.filter(tournament=tournament)


def next_ffa_round(tournament):
    """
    Build the next round from who advanced.

    With `advance` set, only the top N of each lobby carry forward — that is
    the plan's advancement rule. With it at 0, everyone plays every round and
    the winner is whoever accumulates the most points.
    """
    from django.db import models

    config = ffa_settings(tournament)
    last = tournament.matches.aggregate(models.Max("round_no"))["round_no__max"] or 0

    if last >= config["rounds"]:
        return []

    advance = config.get("advance") or 0

    if advance:
        survivors = []
        for lobby in tournament.matches.filter(round_no=last):
            top = lobby.ffa_results.order_by("placement")[:advance]
            survivors.extend(result.entrant for result in top)
    else:
        survivors = list(tournament.entrants.all())

    if len(survivors) < 2:
        return []

    _create_lobbies(tournament, last + 1, survivors, config)
    return Match.objects.filter(tournament=tournament, round_no=last + 1)


def _create_lobbies(tournament, round_no, entrants, config):
    """
    Split `entrants` into lobbies of the configured size.

    A trailing remainder too small to stand alone is folded into the previous
    lobby rather than left as a one-player group, which would be a walkover.
    """
    size = max(2, int(config.get("lobby_size") or 4))
    groups = [entrants[i : i + size] for i in range(0, len(entrants), size)]

    if len(groups) > 1 and len(groups[-1]) < 2:
        groups[-2].extend(groups.pop())

    settings = tournament.settings or {}
    best_of = best_of_for(settings, round_no, config.get("rounds") or 1)

    matches = []
    for position, group in enumerate(groups):
        match = Match.objects.create(
            tournament=tournament,
            round_no=round_no,
            position=position,
            bracket=Match.Bracket.MAIN,
            # a and b stay null: a lobby has no two sides. The roster lives in
            # the FFAResult rows created when the result is reported.
            best_of=best_of,
        )
        # Seat the first two so the match reads sensibly in a generic match list
        # and `is_ready` is true for a lobby awaiting a result.
        match.a = group[0]
        match.b = group[1] if len(group) > 1 else None
        match.save(update_fields=["a", "b"])

        # Placeholder rows record who is *in* the lobby before it is played.
        FFAResult.objects.bulk_create(
            [
                FFAResult(match=match, entrant=entrant, placement=index + 1, points=0)
                for index, entrant in enumerate(group)
            ]
        )
        matches.append(match)

    return matches


def report_ffa_result(match, placements: dict, reported_by=None):
    """
    Record a lobby's finishing order.

    `placements` maps entrant id -> finishing position (1 = first). Points are
    derived from the tournament's table, and `Match.winner` is set to whoever
    came first so the rest of the system treats this like any other result.
    """
    from django.utils import timezone

    config = ffa_settings(match.tournament)
    lobby = list(match.ffa_results.select_related("entrant"))
    lobby_size = len(lobby)

    seen = sorted(placements.values())
    if seen != list(range(1, len(seen) + 1)):
        raise ValueError("Placements must be 1..n with no gaps or ties.")

    if {r.entrant_id for r in lobby} != set(placements):
        raise ValueError("Placements must cover exactly the entrants in this lobby.")

    for result in lobby:
        result.placement = placements[result.entrant_id]
        result.points = points_for(config, result.placement, lobby_size)

    FFAResult.objects.bulk_update(lobby, ["placement", "points"])

    first = min(lobby, key=lambda r: r.placement)
    match.winner = first.entrant
    match.reported_by = reported_by
    match.reported_at = timezone.now()
    match.save(update_fields=["winner", "reported_by", "reported_at"])

    return match
