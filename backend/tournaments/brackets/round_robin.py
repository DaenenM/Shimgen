"""
Round robin.

Built with the circle method: fix one entrant, rotate the rest. For an odd
number of entrants a "ghost" is added, and whoever draws the ghost sits that
round out — which is exactly the bye the plan calls for.

Unlike the elimination formats there is no advancement graph. Every fixture is
known at generation time and nobody is knocked out, so `next_match_win` stays
null throughout and standings come entirely from the played results.
"""

from ..models import Match
from .best_of import best_of_for

__all__ = ["generate_round_robin", "round_robin_rounds"]


def round_robin_rounds(entrants: list) -> list[list[tuple]]:
    """
    Return the fixture list as rounds of (a, b) pairs.

    Pure and database-free so the pairing logic can be tested on its own.
    """
    players = list(entrants)

    # The ghost gives an even count; whoever is drawn against it has a bye.
    ghost = None
    if len(players) % 2:
        players.append(ghost)

    size = len(players)
    if size < 2:
        return []

    rounds = []
    # size - 1 rounds, each entrant meeting every other exactly once.
    for _ in range(size - 1):
        pairs = [
            (players[i], players[size - 1 - i])
            for i in range(size // 2)
            # Drop the ghost fixture — that entrant simply does not play.
            if players[i] is not ghost and players[size - 1 - i] is not ghost
        ]
        rounds.append(pairs)

        # Rotate: the first entrant stays put, the rest shift one place round.
        players = [players[0], players[-1], *players[1:-1]]

    return rounds


def generate_round_robin(tournament, entrants, *, double_round=False):
    """
    Create every fixture.

    `double_round` plays the whole schedule twice with sides reversed, so home
    and away balance out.
    """
    if len(entrants) < 2:
        raise ValueError("A round robin needs at least two entrants.")

    schedule = round_robin_rounds(entrants)
    if double_round:
        # Second leg with the sides swapped.
        schedule += [[(b, a) for a, b in pairs] for pairs in schedule]

    settings = tournament.settings or {}
    total = len(schedule)

    matches = [
        Match(
            tournament=tournament,
            round_no=round_index + 1,
            position=position,
            bracket=Match.Bracket.MAIN,
            a=a,
            b=b,
            best_of=best_of_for(settings, round_index + 1, total),
        )
        for round_index, pairs in enumerate(schedule)
        for position, (a, b) in enumerate(pairs)
    ]

    Match.objects.bulk_create(matches)
    return Match.objects.filter(tournament=tournament)
