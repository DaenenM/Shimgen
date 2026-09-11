"""
Groups, rosters and the games a group plays.

This is the durable half of the data model — the people and the catalogue that
outlive any single tournament. `apps.tournaments` holds the per-event half.
"""

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.common.slugs import unique_slug


class PlayerQuerySet(models.QuerySet):
    def active(self):
        return self.filter(archived=False)

    def recently_used(self):
        """Most recently played first — the order the roster chips render in."""
        return self.order_by(models.F("last_used_at").desc(nulls_last=True), "display_name")


class Player(TimeStampedModel):
    """
    An entry in a host's saved roster. May or may not be a real account.

    This is what powers the clickable name chips when creating an event, and it
    is the durable identity that ratings and stats hang off.

    The Player/Entrant split is load-bearing (plan §5). Player is a person in
    someone's roster; Entrant is that person in one tournament, carrying the
    per-event nickname. Collapsing the two would mean one name per person
    forever, and no way to be "Pig Benis" on Saturday and "Shim" on Sunday while
    keeping a single stat line.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="roster", on_delete=models.CASCADE
    )
    display_name = models.CharField(max_length=60)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="player_profiles",
        # SET_NULL: if the linked account is deleted, the roster entry survives
        # as a plain name and the group's history stays intact.
        on_delete=models.SET_NULL,
        help_text="The linked account, if this roster entry is a real user.",
    )
    last_used_at = models.DateTimeField(null=True, blank=True, db_index=True)
    archived = models.BooleanField(
        default=False, help_text="Hidden from the roster picker without losing history."
    )

    objects = PlayerQuerySet.as_manager()

    class Meta:
        ordering = ["display_name"]
        indexes = [
            # The exact filter behind the roster picker: this host's group,
            # unarchived, most recently played first.
            models.Index(fields=["owner", "archived", "-last_used_at"]),
        ]

    def __str__(self) -> str:
        return self.display_name


class Game(TimeStampedModel):
    """
    A game the group plays — Pummel Party, League of Legends.

    A null `group` marks a global preset offered to everyone, so a new crew is
    not starting from an empty catalogue.
    """

    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=80, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Game, self.name, max_length=80)
        super().save(*args, **kwargs)


class GameMode(TimeStampedModel):
    """
    A mode of a game — Solo/Teams, ARAM/Rift.

    Stats are scoped to Game → Mode (plan §3), so Pummel Party Solo and
    Pummel Party Teams keep separate leaderboards, as they should.
    """

    game = models.ForeignKey(Game, related_name="modes", on_delete=models.CASCADE)
    name = models.CharField(max_length=60)
    is_team_based = models.BooleanField(default=False)

    class Meta:
        ordering = ["game__name", "name"]
        constraints = [models.UniqueConstraint(fields=["game", "name"], name="uniq_mode_per_game")]

    def __str__(self) -> str:
        return f"{self.game.name} — {self.name}"
