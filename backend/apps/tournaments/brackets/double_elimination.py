"""
Double elimination.

The hard part is the losers bracket. It alternates between two kinds of round:

  - a **minor** round, where losers-bracket survivors are joined by fresh drops
    from the winners bracket;
  - a **major** round, where those survivors play each other and nobody drops in.

Losers round 1 is a special case: it is fed entirely by winners round 1, since
nobody has lost twice yet. From there the pattern is minor, major, minor, major…
until one entrant remains.

The other trap is **drop routing**. If winners-round-2 losers are dropped into
the losers bracket in the same order every time, entrants who already met in the
winners bracket are paired again immediately. The standard fix is to reverse (and
on alternating rounds, rotate) the drop order, which is what `_drop_order` does.

The two brackets meet only when a second chance is enabled (`bracket_reset`).
Without it they run independently: the winners final decides 1st and 2nd, the
losers final 3rd and 4th, and losing the winners final ends your tournament
rather than dropping you. With it, the winners finalist and losers finalist meet
in a grand final that the losers side must win twice, since they arrive with a
loss and their opponent does not.

Third place needs no separate playoff either way: whoever loses the losers final
finishes third.
"""

import math

from ..models import Match
from .best_of import best_of_for
from .seeding import bracket_positions, next_power_of_two

__all__ = ["generate_double_elimination"]


def generate_double_elimination(tournament, entrants, **_ignored):
    """
    Build the winners bracket, the losers bracket, and — only when a second
    chance is enabled — a grand final joining them.

    Two shapes, chosen by the `bracket_reset` setting:

      off  Two independent brackets. The winners final decides 1st and 2nd; the
           losers final decides 3rd and 4th. Losing the winners final ends your
           tournament in 2nd, so the losers bracket is a consolation bracket
           rather than a route back to the title.

      on   The two brackets meet in a grand final, and the losers-bracket
           winner must take it twice to lift the title — they arrive with one
           loss, their opponent with none.

    Either way third place is settled by the losers final, so there is no
    separate third-place playoff to configure.
    """
    count = len(entrants)
    if count < 2:
        raise ValueError("A bracket needs at least two entrants.")

    settings = tournament.settings or {}
    size = next_power_of_two(count)
    winners_rounds = size.bit_length() - 1

    # Total rounds is used only to resolve per-round best_of names, and the
    # last winners round is what "final" should mean.
    total = winners_rounds + 2 * winners_rounds

    second_chance = bool(settings.get("bracket_reset"))

    winners = _build_winners(tournament, entrants, size, winners_rounds, settings, total)

    # Without a grand final the winners final is terminal — losing it ends your
    # tournament in 2nd rather than dropping you. That removes one entrant from
    # the losers bracket, so it also runs one round shorter: its last round
    # would otherwise be a walkover for whoever was waiting on that drop.
    losers = _build_losers(
        tournament, winners, winners_rounds, settings, total, drop_final=second_chance
    )

    if second_chance:
        _build_grand_final(tournament, winners, losers, settings, total)

    _resolve_byes(winners[0])

    return Match.objects.filter(tournament=tournament)


# ── Winners bracket ───────────────────────────────────────────────────────────


def _build_winners(tournament, entrants, size, rounds, settings, total):
    """Identical in shape to a single-elimination bracket."""
    order = bracket_positions(size)
    slots = [entrants[s - 1] if s <= len(entrants) else None for s in order]

    first = [
        Match(
            tournament=tournament,
            round_no=1,
            position=position,
            bracket=Match.Bracket.MAIN,
            a=slots[index],
            b=slots[index + 1],
            best_of=best_of_for(settings, 1, total),
        )
        for position, index in enumerate(range(0, size, 2))
    ]
    Match.objects.bulk_create(first)

    built = [first]
    for round_no in range(2, rounds + 1):
        previous = built[-1]
        current = [
            Match(
                tournament=tournament,
                round_no=round_no,
                position=position,
                bracket=Match.Bracket.MAIN,
                best_of=best_of_for(settings, round_no, total),
            )
            for position in range(len(previous) // 2)
        ]
        Match.objects.bulk_create(current)

        for index, match in enumerate(previous):
            match.next_match_win = current[index // 2]
        Match.objects.bulk_update(previous, ["next_match_win"])

        built.append(current)

    return built


# ── Losers bracket ────────────────────────────────────────────────────────────


def _build_losers(tournament, winners, winners_rounds, settings, total, *, drop_final=True):
    """
    Build the losers bracket and wire every drop edge from the winners bracket.

    Returns the rounds as a list of lists, the last entry being the single match
    that decides the losers bracket — 3rd and 4th place, or who reaches the
    grand final when a second chance is enabled.
    """
    built = []
    round_no = 1

    # Losers round 1: fed entirely by winners round 1, two drops per match.
    size = len(winners[0]) // 2
    if size == 0:
        # Only two entrants: there is no losers bracket, and the single winners
        # match feeds both sides of the grand final.
        return []

    current = _make_round(tournament, round_no, size, settings, total)
    _wire_drops(winners[0], current, rotate=False)
    built.append(current)
    round_no += 1

    # From here the bracket alternates, and the widths are forced:
    #
    #   minor round — survivors (one per previous match) meet the drops from the
    #                 next winners round. There are exactly as many drops as
    #                 survivors, so the width equals the previous width.
    #   major round — survivors play each other, halving the width.
    #
    # Winners round k (k >= 2) produces len(winners[k-1]) losers, which always
    # matches the number of survivors coming out of the previous losers round.
    # `drop_final` off means the winners final sends nobody down, so there is
    # no round for its drop to join.
    last_dropping = winners_rounds if drop_final else winners_rounds - 1

    for winners_round in range(1, last_dropping):
        previous = built[-1]
        dropping = winners[winners_round]

        # Minor: same width as the previous losers round. Survivors take slot a,
        # the fresh drops take slot b, so a drop never faces another drop.
        minor = _make_round(tournament, round_no, len(previous), settings, total)
        _wire_progression(previous, minor, one_to_one=True)
        _wire_drops(dropping, minor, rotate=winners_round % 2 == 1, one_to_one=True)
        built.append(minor)
        round_no += 1

        # Major: halve. Skipped when only one match remains — that match already
        # decides the losers finalist.
        if len(minor) > 1:
            major = _make_round(tournament, round_no, len(minor) // 2, settings, total)
            _wire_progression(minor, major)
            built.append(major)
            round_no += 1

    return built


def _make_round(tournament, round_no, size, settings, total):
    matches = [
        Match(
            tournament=tournament,
            round_no=round_no,
            position=position,
            bracket=Match.Bracket.LOSERS,
            best_of=best_of_for(settings, round_no, total),
        )
        for position in range(size)
    ]
    Match.objects.bulk_create(matches)
    return matches


def _wire_progression(source, target, *, one_to_one=False):
    """
    Advance winners of `source` into `target`.

    `one_to_one` is the minor round: each survivor keeps its own match and is
    joined there by a drop. Otherwise two matches merge into one, the ordinary
    halving of a major round.
    """
    for index, match in enumerate(source):
        match.next_match_win = target[index if one_to_one else index // 2]
    Match.objects.bulk_update(source, ["next_match_win"])


def _wire_drops(winners_round, losers_round, *, rotate, one_to_one=False):
    """
    Route losers of `winners_round` down into `losers_round`.

    The order is deliberately not the identity. Dropping in bracket order pairs
    entrants who just played each other in the winners bracket; reversing (and
    rotating on alternate rounds) pushes a rematch as late as possible.
    """
    order = _drop_order(len(winners_round), rotate=rotate)

    for target_index, source_index in enumerate(order):
        source = winners_round[source_index]
        source.next_match_lose = losers_round[target_index if one_to_one else target_index // 2]

    Match.objects.bulk_update(winners_round, ["next_match_lose"])


def _drop_order(size, *, rotate):
    """
    The order winners-bracket losers enter the losers bracket.

    Reversed by default. On alternating rounds it is additionally rotated by a
    half turn, which is the standard scheme for keeping rematches apart.
    """
    order = list(reversed(range(size)))

    if rotate and size > 1:
        half = size // 2
        order = order[half:] + order[:half]

    return order


# ── Grand final ───────────────────────────────────────────────────────────────


def _build_grand_final(tournament, winners, losers, settings, total):
    """
    Create the grand final and the decider behind it.

    Only called when a second chance is enabled. The winners-bracket finalist
    arrives undefeated and the losers-bracket finalist with one loss, so the
    losers side must win twice: taking the first match only levels the score and
    forces the decider.

    The decider is created up front but seated only if that actually happens, so
    it stays empty — and hidden — when the undefeated side holds.
    """
    winners_final = winners[-1][0]
    losers_final = losers[-1][0] if losers else None

    grand = Match.objects.create(
        tournament=tournament,
        round_no=len(winners) + len(losers) + 1,
        position=0,
        bracket=Match.Bracket.FINAL,
        best_of=best_of_for(settings, total, total),
    )

    winners_final.next_match_win = grand
    winners_final.save(update_fields=["next_match_win"])

    if losers_final is not None:
        losers_final.next_match_win = grand
        losers_final.save(update_fields=["next_match_win"])
    else:
        # Two entrants: the loser of the only match is the "losers finalist".
        winners_final.next_match_lose = grand
        winners_final.save(update_fields=["next_match_lose"])

    # The decider. Only reached if the losers finalist wins the first match —
    # the whole point of the second chance is that they must do it twice.
    reset = Match.objects.create(
        tournament=tournament,
        round_no=grand.round_no + 1,
        position=0,
        bracket=Match.Bracket.FINAL,
        best_of=best_of_for(settings, total, total),
    )
    grand.next_match_win = reset
    grand.save(update_fields=["next_match_win"])

    return grand


def _resolve_byes(first_round):
    from .advance import advance_winner

    for match in first_round:
        if match.a_id and not match.b_id:
            advance_winner(match, match.a, bye=True)
        elif match.b_id and not match.a_id:
            advance_winner(match, match.b, bye=True)


def rounds_for(entrant_count: int) -> int:
    """Total rounds a double-elimination bracket needs, useful for UI layout."""
    winners = max(1, math.ceil(math.log2(max(entrant_count, 2))))
    return winners + 2 * winners - 1
