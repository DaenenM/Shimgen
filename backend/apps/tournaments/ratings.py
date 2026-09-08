"""
Elo ratings.

Plan §4, NEW 1 — the feature that turns three tools sharing a domain into one
product. Results sharpen ratings, ratings drive balanced team generation, and
fairer teams make more games worth playing.

Ratings are per player, per game mode: being good at Pummel Party says nothing
about your ARAM. Team matches distribute the change across each side's members,
so a team result still teaches the system about the individuals in it.
"""

from django.db import transaction

from .models import Rating

__all__ = ["apply_match_result", "expected_score", "rate_tournament"]

# Standard Elo K-factor. 32 is the chess default for new players and is right
# here: game nights are short seasons, so ratings need to move fast enough to be
# useful within a few evenings rather than converging over hundreds of games.
K_FACTOR = 32
PROVISIONAL_K = 64
PROVISIONAL_GAMES = 10
DEFAULT_ELO = 1200


def expected_score(rating_a: float, rating_b: float) -> float:
    """
    Probability that A beats B under the logistic Elo curve.

    A 400-point gap means the stronger side is expected to win about 10 times
    out of 11 — the property that gives Elo its scale.
    """
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def k_for(rating: Rating) -> int:
    """
    A larger K while a rating is provisional.

    A new player's 1200 is a guess, so early results should move it a long way.
    After ten games the rating has meaning and settles to the normal factor.
    """
    return PROVISIONAL_K if rating.games < PROVISIONAL_GAMES else K_FACTOR


@transaction.atomic
def apply_match_result(match):
    """
    Update ratings for one completed head-to-head match.

    Skipped for byes, unreported matches and tournaments with no mode set — a
    quick-start bracket with no game attached has nothing to rate against.
    """
    tournament = match.tournament
    mode = tournament.mode

    if mode is None or not match.winner_id or not (match.a_id and match.b_id):
        return

    side_a = _ratings_for(match.a, mode)
    side_b = _ratings_for(match.b, mode)

    if not side_a or not side_b:
        # Ad-hoc entrants with no roster entry behind them; nothing to attribute.
        return

    mean_a = sum(r.elo for r in side_a) / len(side_a)
    mean_b = sum(r.elo for r in side_b) / len(side_b)

    a_won = match.winner_id == match.a_id
    _adjust(side_a, expected_score(mean_a, mean_b), 1.0 if a_won else 0.0)
    _adjust(side_b, expected_score(mean_b, mean_a), 0.0 if a_won else 1.0)


def _adjust(ratings, expected: float, actual: float):
    """
    Move a side's ratings toward the result.

    Every member of a team takes the same adjustment, computed from the team's
    mean. Beating a stronger team lifts everyone; the individual differences
    come out over many games rather than being guessed at from one.
    """
    for rating in ratings:
        rating.elo += k_for(rating) * (actual - expected)
        rating.games += 1
        if actual == 1.0:
            rating.wins += 1
        elif actual == 0.0:
            rating.losses += 1

    Rating.objects.bulk_update(ratings, ["elo", "games", "wins", "losses"])


def _ratings_for(entrant, mode) -> list[Rating]:
    """Fetch or create a Rating row for each player behind `entrant`."""
    return [
        Rating.objects.get_or_create(player=player, mode=mode, defaults={"elo": DEFAULT_ELO})[0]
        for player in entrant.players.all()
    ]


@transaction.atomic
def rate_tournament(tournament):
    """
    Apply ratings for every completed match, in play order.

    Order matters: Elo is path-dependent, so replaying a tournament's matches
    out of sequence gives different numbers. Sorting by when the result was
    reported reproduces the order they actually happened in.
    """
    if tournament.mode_id is None:
        return

    matches = (
        tournament.matches.filter(winner__isnull=False)
        .exclude(a__isnull=True)
        .exclude(b__isnull=True)
        .order_by("reported_at", "round_no", "position")
    )

    for match in matches:
        apply_match_result(match)


def leaderboard(mode, *, limit: int = 50):
    """Top-rated players in one mode, for the group's leaderboard page."""
    return Rating.objects.filter(mode=mode).select_related("player").order_by("-elo")[:limit]


def head_to_head(player_a, player_b, mode=None) -> dict:
    """
    The "you're 3-11 against Mark" stat (plan §4, NEW 7).

    Cheap to compute from data already stored, and the most shareable thing a
    friend group produces — this is the screenshot that goes back into Discord.
    """
    from .models import Match

    matches = Match.objects.filter(winner__isnull=False).filter(
        a__players=player_a, b__players=player_b
    ) | Match.objects.filter(winner__isnull=False).filter(a__players=player_b, b__players=player_a)

    if mode is not None:
        matches = matches.filter(tournament__mode=mode)

    wins = losses = 0
    for match in matches.distinct().select_related("winner").prefetch_related("winner__players"):
        winners = {p.id for p in match.winner.players.all()}
        if player_a.id in winners:
            wins += 1
        elif player_b.id in winners:
            losses += 1

    return {"wins": wins, "losses": losses, "played": wins + losses}
