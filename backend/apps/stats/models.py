"""
Tally boards — the stats people actually keep.

The Game/Mode/Rating tables model competition that runs through a bracket.
This models the other half, which is most of a game night: someone wins a round
of Pummel Party, a name gets another emoji, and nobody generated a tournament
for it (plan §3).

The shape is deliberately loose, because the point is that the crew decides what
is worth counting. A `StatsBoard` is a page — "Pummel Party Wins". It holds one
or more `StatsTable`s (Solo, Teams), each with its own `StatsColumn`s, and each
column carries the emoji that gets stamped. Rows are `StatsRow`s, and a row may
point at a roster `Player` or just carry a name.

Counts live in `StatsEntry`, one per (row, column). Storing a count rather than
one record per win keeps the common read — draw the whole board — a single
query, and makes incrementing an atomic F() update instead of an insert plus a
recount.
"""

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.common.slugs import random_slug
from apps.groups.models import Player


class StatsBoard(TimeStampedModel):
    """
    One stats page — "Pummel Party Wins".

    Shareable by slug, the same way the spectator bracket is (plan §4, NEW 2): a
    crew wants to send the board to the group chat, not manage accounts for
    everyone in it.
    """

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=60, unique=True, blank=True)
    description = models.TextField(blank=True)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="stats_boards",
        # PROTECT: deleting an account
        # must not quietly take a crew's accumulated history with it.
        on_delete=models.PROTECT,
    )

    favourited_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        # A timestamp rather than a flag, because favourites are ordered among
        # themselves: the one pinned first stays first, and the next sits below
        # it rather than displacing it.
        help_text="When this was pinned to the top of the list. Null if it is not.",
    )

    class Meta:
        # Favourites first, oldest pin at the top so the order is the order they
        # were chosen in. NULLS LAST puts everything else underneath, newest
        # first — the board you just made is the one you are about to open, and
        # alphabetical order buried it wherever its name happened to fall.
        ordering = [models.F("favourited_at").asc(nulls_last=True), "-created_at"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            # A short opaque id, not a slugified name. The shared URL already
            # carries the name as its last segment, so deriving the slug from it
            # too gave /stats/saturday-league-4248/saturday-league — the name
            # twice, once with a collision suffix stuck to it. This half is the
            # identity; the readable half is added by the link builder.
            self.slug = random_slug(10)
        super().save(*args, **kwargs)

    def role_for(self, user) -> str | None:
        """
        `owner`, `editor`, `viewer`, or None — the one answer to "what may they
        do".

        **viewer** is derived rather than granted: somebody listed on the board
        can see it. Being counted on a crew's board is already a statement that
        you play with them, so needing a share link to look at your own record
        was a gap rather than a safeguard — and it is read-only, because
        `may_edit` asks for owner or editor.
        """
        if not getattr(user, "is_authenticated", False):
            return None
        if self.owner_id == user.id:
            return "owner"

        access = self.access.filter(user=user).first()
        if access:
            return access.role

        if self.has_row_for(user):
            return "viewer"

        return None

    def has_row_for(self, user) -> bool:
        """Whether `user` appears as a competitor on any of this board's tables."""
        return StatsRow.objects.filter(table__board=self, player__user=user).exists()

    def may_edit(self, user) -> bool:
        """Whether `user` may add marks and link tournaments."""
        return self.role_for(user) in {"owner", "editor"}


class BoardAccess(TimeStampedModel):
    """
    Someone the owner has let in.

    Editors may tally and link tournaments to the board; they may not restructure
    it or hand out access themselves. That split is what makes sharing safe — the
    person who set the board up keeps its shape, and everyone else gets to use it
    without asking permission every Saturday.
    """

    class Role(models.TextChoices):
        EDITOR = "editor", "Editor"

    board = models.ForeignKey(StatsBoard, related_name="access", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="stats_access", on_delete=models.CASCADE
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.EDITOR)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="stats_invites_sent",
        on_delete=models.SET_NULL,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["board", "user"], name="uniq_board_access"),
        ]

    def __str__(self) -> str:
        return f"{self.user} on {self.board} ({self.role})"


class StatsTable(TimeStampedModel):
    """
    A section of a board — "Solo", "Teams".

    A board is usually one table. It is two when the crew counts the same night
    two ways, which is exactly the Pummel Party case: the same people, solo wins
    and team wins kept apart.
    """

    board = models.ForeignKey(StatsBoard, related_name="tables", on_delete=models.CASCADE)
    name = models.CharField(max_length=80)
    position = models.PositiveIntegerField(default=0, help_text="Display order within the board.")

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.board.name} — {self.name}"


class StatsColumn(TimeStampedModel):
    """
    A countable thing, and the mark that represents it.

    The emoji is the feature rather than decoration — a row of tridents reads at
    a glance in a way a number in a cell does not, and it is how the crew
    already keeps this in a chat message.

    Two fields make a column more than a name. `role` says what a linked
    tournament counts into it, so awarding never has to match on a label the
    crew is free to rename. `display` says how to draw it, because a games
    tally reaching forty is a wall of glyphs nobody reads — those want a number.
    """

    class Role(models.TextChoices):
        """What a finished tournament adds to this column."""

        MANUAL = "manual", "Counted by hand"
        PLAYED = "played", "Games played"
        WON = "won", "Games won"
        LOST = "lost", "Games lost"
        TOURNAMENTS_WON = "tournaments_won", "Tournaments won"

    class Display(models.TextChoices):
        EMOJI = "emoji", "A mark per point"
        NUMBER = "number", "A number"

    table = models.ForeignKey(StatsTable, related_name="columns", on_delete=models.CASCADE)
    name = models.CharField(max_length=60)
    emoji = models.CharField(
        max_length=16,
        default="\N{TRIDENT EMBLEM}",
        help_text="Stamped once per point. Long enough for multi-codepoint emoji.",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MANUAL,
        db_index=True,
        help_text="What a linked tournament counts into this column.",
    )
    display = models.CharField(max_length=10, choices=Display.choices, default=Display.EMOJI)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(fields=["table", "name"], name="uniq_column_per_table"),
            # One column per automatic role, so a result has exactly one place
            # to land. Manual columns are unconstrained — a crew may keep as
            # many hand-counted tallies as they like.
            models.UniqueConstraint(
                fields=["table", "role"],
                condition=~models.Q(role="manual"),
                name="uniq_automatic_role_per_table",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.table.name} — {self.name}"


class StatsRow(TimeStampedModel):
    """
    A competitor on a table.

    `player` links the row to the saved roster, which is what lets a finished
    tournament find the right row. A row without one is a plain name — fine for
    someone who turns up once — and it can be linked later without losing the
    tally it already has.
    """

    table = models.ForeignKey(StatsTable, related_name="rows", on_delete=models.CASCADE)
    player = models.ForeignKey(
        Player,
        null=True,
        blank=True,
        related_name="stats_rows",
        # SET_NULL rather than CASCADE: removing someone from a roster should
        # not erase the eight wins they earned.
        on_delete=models.SET_NULL,
    )
    label = models.CharField(
        max_length=60,
        blank=True,
        help_text="Shown on the board. Falls back to the linked player's name.",
    )
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.display_name

    @property
    def display_name(self) -> str:
        if self.label:
            return self.label
        return self.player.display_name if self.player_id else ""


class StatsEntry(TimeStampedModel):
    """
    How many marks one row has in one column.

    A count, not one record per win. The board is read far more often than it is
    written, and drawing it should not mean counting rows — while incrementing
    stays atomic via an F() update, so two people tapping +1 at once cannot lose
    a win between them.
    """

    row = models.ForeignKey(StatsRow, related_name="entries", on_delete=models.CASCADE)
    column = models.ForeignKey(StatsColumn, related_name="entries", on_delete=models.CASCADE)
    count = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["row", "column"], name="uniq_entry_per_row_column"),
            # A tally cannot go below zero. Undo stops at empty rather than
            # wrapping into negatives, which would render as no emoji at all and
            # then take several clicks to come back.
            models.CheckConstraint(condition=models.Q(count__gte=0), name="entry_count_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.row.display_name} — {self.column.name}: {self.count}"


class BoardLink(TimeStampedModel):
    """
    A tournament feeding a table.

    Everything it writes is credited **by player, never by team name**. A 3v3 win
    is three people's win, and "Team Benis" is not a competitor that persists
    past Saturday.

    The link is to a `table`, because one tournament feeds several columns at
    once: games played, won and lost as the bracket is reported, and tournaments
    won when it finishes. `column` narrows that to a single hand-made tally for
    a board that only wants "who won the night" — the two are mutually
    exclusive, which the check constraint enforces.

    `awarded` covers only the end-of-tournament credit. Per-game counts are
    recomputed from the match rows every time a result changes, so correcting a
    bracket corrects the board rather than double-counting into it.
    """

    tournament = models.OneToOneField(
        "tournaments.Tournament",
        related_name="stats_link",
        on_delete=models.CASCADE,
    )
    table = models.ForeignKey(
        StatsTable,
        null=True,
        blank=True,
        related_name="links",
        on_delete=models.CASCADE,
        help_text="Feeds every automatic column on this table.",
    )
    column = models.ForeignKey(
        StatsColumn,
        null=True,
        blank=True,
        related_name="links",
        on_delete=models.CASCADE,
        help_text="A single hand-made tally to mark instead.",
    )
    awarded = models.BooleanField(default=False, db_index=True)
    awarded_at = models.DateTimeField(null=True, blank=True)
    awarded_player_ids = models.JSONField(
        default=list,
        blank=True,
        # Recorded rather than inferred: once a final is corrected the bracket
        # no longer knows who used to be winning, so taking the trophy back
        # would have nobody to take it from.
        help_text="Players this link credited, so the credit can be undone.",
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(table__isnull=False, column__isnull=True)
                    | models.Q(table__isnull=True, column__isnull=False)
                ),
                name="link_targets_a_table_or_a_column",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.tournament} -> {self.table or self.column}"

    @property
    def stats_table(self):
        """The table this link writes into, whichever way it was made."""
        return self.table or (self.column.table if self.column_id else None)
