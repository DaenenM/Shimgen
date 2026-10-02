"""Slug generation for public, shareable URLs."""

import secrets
import string

from django.utils.text import slugify

# Unambiguous alphabet: no 0/O or 1/l/I, so a slug read aloud or copied off a
# second monitor does not turn into a 404.
ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def random_slug(length: int = 10) -> str:
    """
    Return an unguessable slug for a spectator link.

    Spectator URLs are unlisted rather than access-controlled (plan §4, NEW 2),
    so the slug is the only thing keeping a tournament private. At length 10
    over a 31-character alphabet that is ~49 bits — far past anything worth
    enumerating for a game-night bracket. `secrets` rather than `random`
    because the latter's PRNG state is recoverable from previous outputs.
    """
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def unique_slug(model, value: str, field: str = "slug", max_length: int = 50) -> str:
    """
    Slugify `value` and append a short suffix if that slug is already taken.

    Used for human-readable slugs such as a group's ("saturday-crew"), where the
    readable form matters and a collision is rare. `random_slug` is the right
    call for anything that must be unguessable.
    """
    base = slugify(value)[:max_length] or random_slug(6)
    candidate = base

    while model.objects.filter(**{field: candidate}).exists():
        suffix = "".join(secrets.choice(string.digits) for _ in range(4))
        candidate = f"{base[: max_length - 5]}-{suffix}"

    return candidate
