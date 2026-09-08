"""Model factories for tests."""

import factory

from apps.tournaments.models import Entrant, Tournament


class TournamentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tournament

    format = Tournament.Format.SINGLE
    state = Tournament.State.DRAFT
    title = factory.Sequence(lambda n: f"Tournament {n}")
    settings = factory.Dict({})


def make_entrants(tournament, count, *, seeded=True):
    """
    Create `count` entrants labelled P1..Pn, seeded 1..n in order.

    Returned in seed order, which is what the generators expect.
    """
    return [
        Entrant.objects.create(
            tournament=tournament,
            label=f"P{i}",
            seed=i if seeded else None,
        )
        for i in range(1, count + 1)
    ]
