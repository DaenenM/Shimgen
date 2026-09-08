"""
Result reporting and advancement.

This is the one routine every elimination format shares. Because the match graph
is generated up front with `next_match_win` / `next_match_lose` edges, reporting
a result is just: record it, then push each side along its edge. Double
elimination needs no special-case code — its drop routing is already in the data
(plan §5).
"""

from django.db import models, transaction
from django.utils import timezone

from ..models import Match

__all__ = ["advance_winner", "clear_result", "report_result"]


class ResultError(Exception):
    """A result that cannot be applied — surfaced to the API as a 400."""


@transaction.atomic
def report_result(match, *, score_a: int, score_b: int, reported_by=None):
    """
    Record a series score and advance both sides if it resolves the match.

    `score_a` / `score_b` are series wins, so a Bo5 ending 3–1 is (3, 1). The
    match resolves when a side reaches `wins_needed`; below that the score is
    stored as an in-progress series and nobody advances yet.
    """
    if not match.is_ready:
        raise ResultError("Both entrants must be decided before reporting a result.")

    if score_a < 0 or score_b < 0:
        raise ResultError("Scores cannot be negative.")

    needed = match.wins_needed
    if score_a > needed or score_b > needed:
        raise ResultError(f"A best-of-{match.best_of} series ends at {needed} wins.")

    if score_a == needed and score_b == needed:
        raise ResultError("Both sides cannot win the series.")

    # Reporting over an existing result is a correction, not an append. Undo the
    # old advancement first, or the previous winner is left sitting in the next
    # round alongside the new one.
    if match.winner_id:
        _retract(match)

    match.score = {"a": score_a, "b": score_b}
    match.reported_by = reported_by
    match.reported_at = timezone.now()

    if score_a == needed:
        winner, loser = match.a, match.b
    elif score_b == needed:
        winner, loser = match.b, match.a
    else:
        # Series still in progress — save the running score and stop.
        match.winner = None
        match.save(update_fields=["score", "winner", "reported_by", "reported_at"])
        return match

    match.winner = winner
    match.save(update_fields=["score", "winner", "reported_by", "reported_at"])

    advance_winner(match, winner, loser=loser)
    return match


def advance_winner(match, winner, *, loser=None, bye=False):
    """
    Push `winner` into the next match, and `loser` down the losers edge.

    In single elimination `next_match_lose` is null except for the semifinals
    when a third-place match exists, so the loser simply stops. In double
    elimination it is the drop route into the losers bracket.
    """
    if bye:
        # A bye is not a played match: record the walkover but leave the score
        # empty and do not credit anyone with a win in the stats.
        match.winner = winner
        match.save(update_fields=["winner"])

    # Handled before any placement: the grand final's next_match_win is the
    # decider, and seating the winner there generically would make it look live
    # even when the undefeated side held and it will never be played.
    if match.bracket == Match.Bracket.FINAL:
        _resolve_grand_final(match, winner, loser)
        return

    _place(match.next_match_win, match, winner)

    if loser is not None:
        _place(match.next_match_lose, match, loser, dropping=True)
        if match.next_match_lose_id is None:
            # Nowhere left to go: knocked out.
            loser.eliminated = True
            loser.save(update_fields=["eliminated"])

    # With no grand final the losers final leads nowhere: it settles 3rd and
    # 4th, so even its winner is out of the tournament. Without this the bracket
    # ends with two survivors — the winners champion and the losers champion.
    _eliminate_losers_champion(match, winner)

    _cascade_byes(match.next_match_win)
    _cascade_byes(match.next_match_lose)


def _eliminate_losers_champion(match, winner):
    """
    Knock out the winner of a terminal losers-bracket match.

    Only happens when there is no grand final: the losers final then settles 3rd
    and 4th, so even the entrant who wins it is out. Without this the tournament
    ends with two survivors — the winners champion and the losers champion.
    """
    if match.bracket != Match.Bracket.LOSERS or match.next_match_win_id is not None:
        return
    if winner is None or winner.eliminated:
        return

    winner.eliminated = True
    winner.save(update_fields=["eliminated"])


def _resolve_grand_final(match, winner, loser):
    """
    Decide the tournament at the grand final, honouring the bracket-reset rule.

    The winners finalist arrives undefeated, the losers finalist with one loss:

      - Winners finalist wins  -> the losers finalist has two losses. Over, and
                                  any decider stays unplayed.
      - Losers finalist wins   -> one loss each. With bracket reset enabled they
                                  play the decider; without it, the win stands.

    Spelled out rather than folded into the generic path because the asymmetry
    is the whole point of the rule, and getting it wrong is what competitive
    players notice immediately (plan §3).
    """
    decider = match.next_match_win

    # `a` is always the undefeated side — see _slot_for.
    if decider is None or winner.id == match.a_id:
        if loser is not None:
            loser.eliminated = True
            loser.save(update_fields=["eliminated"])
        return

    # The losers finalist took it, so the decider is now live.
    decider.a = match.a
    decider.b = match.b
    decider.save(update_fields=["a", "b"])


def _place(target, source, entrant, *, dropping=False):
    """
    Seat `entrant` in `target`, choosing the slot by where it came from.

    Slot choice is deterministic rather than "first empty": the feeder decides
    the side, so a bracket redraw always puts the same entrant on the same line,
    and two results arriving out of order cannot swap them.

    In a losers-bracket minor round one match receives both a survivor and a
    fresh drop from the winners bracket. Both feeders can sit at the same
    position, so position alone would put them in the same slot and lose one of
    them. Drops therefore always take slot b, survivors slot a.
    """
    if target is None or entrant is None:
        return

    slot = _slot_for(target, source, dropping=dropping)

    # Guard against double-placing if a result is reported twice concurrently.
    if getattr(target, f"{slot}_id") == entrant.id:
        return

    setattr(target, slot, entrant)
    target.save(update_fields=[slot])


def _slot_for(target, source, *, dropping: bool) -> str:
    """Which side of `target` an entrant arriving from `source` occupies."""
    if target.bracket == Match.Bracket.LOSERS and _is_minor_round(target):
        return "b" if dropping else "a"

    # The grand final seats the undefeated side in a and the side coming up from
    # the losers bracket in b. In a 2-entrant bracket both edges come from the
    # same match, so position alone cannot distinguish them.
    if target.bracket == Match.Bracket.FINAL:
        return "b" if dropping or source.bracket == Match.Bracket.LOSERS else "a"

    # A third-place playoff is fed by two losers rounds, both along the losing
    # edge, so `dropping` cannot tell them apart. The later round takes slot a:
    # its loser went out one round deeper and is the higher finisher.
    if target.bracket == Match.Bracket.THIRD and source.bracket == Match.Bracket.LOSERS:
        deepest = (
            Match.objects.filter(next_match_lose=target, bracket=Match.Bracket.LOSERS)
            .order_by("-round_no")
            .values_list("round_no", flat=True)
            .first()
        )
        return "a" if source.round_no == deepest else "b"

    return "a" if source.position % 2 == 0 else "b"


def _is_minor_round(match) -> bool:
    """
    True when `match` takes one survivor and one fresh drop.

    Detected from the graph rather than stored: a minor round is exactly a
    losers match fed by both a winners-bracket drop and a losers-bracket winner.
    """
    return (
        Match.objects.filter(next_match_lose=match, bracket=Match.Bracket.MAIN).exists()
        and Match.objects.filter(next_match_win=match, bracket=Match.Bracket.LOSERS).exists()
    )


def _cascade_byes(match):
    """
    Auto-advance through a match that can never be contested.

    With several byes in one bracket, an entrant can be handed two walkovers in
    a row — a 5-entrant bracket does exactly this. Without cascading, the
    bracket stalls on a round-two match whose second slot will never fill.
    """
    if match is None:
        return

    match.refresh_from_db()

    # Only cascade when the empty slot is genuinely unfillable: every feeder is
    # resolved, and between them they delivered just one entrant.
    if match.winner_id or match.is_ready:
        return

    if not _feeders_settled(match):
        return

    present = match.a or match.b

    # `present` may legitimately be None: in a bracket with many byes, both
    # feeders of a losers-bracket match can be walkovers that produce no loser
    # at all. That match is a phantom — it resolves to nobody, and the cascade
    # must continue past it or everything downstream deadlocks.
    if present is not None:
        match.winner = present
        match.save(update_fields=["winner"])
        _place(match.next_match_win, match, present)
        _eliminate_losers_champion(match, present)

    # Follow both edges. A cascading bye in the winners bracket still has a drop
    # edge, and the losers match on the far end may itself now be unfillable —
    # in a 9- or 17-entrant bracket that chain runs several matches deep.
    _cascade_byes(match.next_match_win)
    _cascade_byes(match.next_match_lose)


def _feeders_settled(match) -> bool:
    """
    True when nothing further can arrive in `match`.

    A feeder counts as settled once it has a winner. That covers the bye case
    that would otherwise deadlock the losers bracket: a winners-bracket bye has
    a winner but no loser, so its drop edge will never deliver anybody, and the
    losers match it feeds must advance whoever is already sitting there rather
    than waiting forever.
    """
    feeders = Match.objects.filter(models.Q(next_match_win=match) | models.Q(next_match_lose=match))

    for feeder in feeders:
        if feeder.winner_id:
            continue
        # A phantom — a match both of whose own feeders were byes — never gets a
        # winner but is nonetheless finished. Anything else is still to be played.
        if not _is_phantom(feeder):
            return False

    return True


def _is_phantom(match) -> bool:
    """
    True when `match` can never be contested and will never produce a winner.

    Reached only in heavily-byed brackets: a losers-bracket match whose two
    feeders were both walkovers has nobody to seat and nobody to send on.
    """
    if match.a_id or match.b_id or match.winner_id:
        return False

    feeders = Match.objects.filter(models.Q(next_match_win=match) | models.Q(next_match_lose=match))
    if not feeders.exists():
        return False

    return all(f.winner_id or _is_phantom(f) for f in feeders)


@transaction.atomic
def clear_result(match):
    """Undo a reported result, including everything it advanced."""
    if not match.winner_id:
        return match

    _retract(match)

    match.winner = None
    match.score = {}
    match.reported_at = None
    match.reported_by = None
    match.save(update_fields=["winner", "score", "reported_at", "reported_by"])
    return match


def _retract(match):
    """
    Remove this match's entrants from wherever it advanced them.

    Recurses forward: if the winner already won the next match too, that result
    is cleared as well. Correcting a quarterfinal cannot leave a stale entrant
    standing in the final.
    """
    for target_id, dropping in (
        (match.next_match_win_id, False),
        (match.next_match_lose_id, True),
    ):
        if target_id is None:
            continue

        # Re-read rather than using the cached relation: an earlier iteration,
        # or the recursive clear_result below, may already have changed this row,
        # and writing a stale copy back would undo that.
        target = Match.objects.get(pk=target_id)

        slot = _slot_for(target, match, dropping=dropping)
        if getattr(target, f"{slot}_id") is None:
            continue

        if target.winner_id:
            clear_result(target)
            target.refresh_from_db()

        setattr(target, slot, None)
        target.save(update_fields=[slot])

    if match.a_id:
        match.a.eliminated = False
        match.a.save(update_fields=["eliminated"])
    if match.b_id:
        match.b.eliminated = False
        match.b.save(update_fields=["eliminated"])
