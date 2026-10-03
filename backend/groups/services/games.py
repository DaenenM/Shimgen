"""Turns a typed game name into a Game. Used by the tournament create view."""

import re
import unicodedata

from ..models import Game


def normalize(text: str) -> str:
    """Lowercase, accents and punctuation stripped: "CS:GO" and "csgo" compare equal."""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", text.lower())


def resolve_game(name: str) -> Game | None:
    """Preset matched by name or nickname, else the user's own game (reused or created)."""
    name = " ".join(str(name or "").split())
    key = normalize(name)
    if not key:
        return None

    for game in Game.objects.filter(is_preset=True):
        if key == normalize(game.name) or key in (normalize(a) for a in game.aliases):
            return game

    existing = Game.objects.filter(is_preset=False, name__iexact=name).first()
    return existing or Game.objects.create(name=name[:80])
