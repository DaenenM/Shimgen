"""
Tournaments, entrants, matches and ratings.

The central design decision is that a tournament's match graph is generated up
front, with each Match carrying `next_match_win` and `next_match_lose` edges.
Reporting a result then just pushes entrants along those edges, so one
advancement routine serves every format and double elimination becomes data
rather than special-case code (plan §5).

Standings are computed from Match rows, never stored, so there are no
denormalised counters to drift out of sync.
"""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel
from apps.common.slugs import random_slug
from apps.groups.models import GameMode, Player


class Tournament(TimeStampedModel):
    """One event: a bracket, a round robin, a Swiss pool or an FFA series."""

    class Format(models.TextChoices):
        SINGLE = "single", "Single elimination"
        DOUBLE = "double", "Double elimination"
        ROUND_ROBIN = "rr", "Round robin"
        SWISS = "swiss", "Swiss"
        FFA = "ffa", "Free-for-all"

    class State(models.TextChoices):
        DRAFT = "draft", "Draft"
        # A captain draft is running: the tournament exists and has settings,
        # but no entrants yet — they are created when the draft completes. Note
        # the unfortunate near-collision with DRAFT above, which means "created
        # but not started" and has nothing to do with drafting players. See
        # TeamDraft.
        DRAFTING = "drafting", "Drafting teams"
        ACTIVE = "active", "Active"
        COMPLETE = "complete", "Complete"

    mode = models.ForeignKey(
        GameMode,
        null=True,
        blank=True,
        related_name="tournaments",
        # PROTECT: a mode with recorded history cannot be deleted out from
        # under the stats that reference it.
        on_delete=models.PROTECT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="created_tournaments",
        on_delete=models.SET_NULL,
    )

    format = models.CharField(max_length=8, choices=Format.choices)
    # `state` gates late joins: entrants are freely editable in draft, and
    # elimination brackets refuse new entrants once active (plan §3).
    state = models.CharField(
        max_length=8, choices=State.choices, default=State.DRAFT, db_index=True
    )

    title = models.CharField(max_length=140, blank=True)
    description = models.TextField(blank=True)
    rules = models.TextField(blank=True)
    third_place_match = models.BooleanField(default=False)

    # Format-specific configuration that would otherwise need a column per
    # format: grand-final bracket reset, round-robin points, best_of defaults
    # per round, FFA lobby size and advancement rules.
    settings = models.JSONField(default=dict, blank=True)

    # The spectator link (plan §4, NEW 2). Unguessable, so an unlisted URL is
    # the access control; see apps.common.slugs.random_slug.
    public_slug = models.SlugField(max_length=16, unique=True, blank=True, db_index=True)
    # Lets a logged-out host reclaim a quick-start bracket after signing up.
    claim_token = models.CharField(max_length=32, blank=True, db_index=True)

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    favourited_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        # A timestamp rather than a flag: favourites are ordered among
        # themselves, so the one pinned first stays first.
        help_text="When this was pinned to the top of the list. Null if it is not.",
    )
    archived = models.BooleanField(
        default=False,
        db_index=True,
        # The same bargain the roster strikes: a finished night stops cluttering
        # the list without its results leaving the record. Deleting is the other
        # option and it takes the stats with it, so this is what a host wants
        # for a season that is simply over.
        help_text="Hidden from the tournament list without losing its results.",
    )

    class Meta:
        # Favourites first, oldest pin at the top so the order is the order they
        # were chosen in; everything else newest-first underneath.
        ordering = [models.F("favourited_at").asc(nulls_last=True), "-created_at"]

    def __str__(self) -> str:
        return self.title or f"{self.get_format_display()} #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.public_slug:
            self.public_slug = random_slug(10)
        super().save(*args, **kwargs)

    @property
    def accepts_late_entrants(self) -> bool:
        """
        Whether an entrant can join without rebuilding the bracket.

        An elimination bracket is a fixed tree — a node cannot be inserted
        without regenerating it, which would clear results. The UI says so
        plainly rather than silently doing something surprising (plan §8).
        """
        if self.state == self.State.DRAFT:
            return True
        if self.state == self.State.COMPLETE:
            return False
        return self.format in {self.Format.SWISS, self.Format.ROUND_ROBIN, self.Format.FFA}


class Role(TimeStampedModel):
    """
    Who may act on a tournament (plan §4, NEW 12).

    Three roles are enough: host, co-host (report results), and spectator, which
    needs no row at all — it is what anyone holding the public link gets.
    """

    class Kind(models.TextChoices):
        HOST = "host", "Host"
        COHOST = "cohost", "Co-host"

    tournament = models.ForeignKey(Tournament, related_name="roles", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="tournament_roles", on_delete=models.CASCADE
    )
    role = models.CharField(max_length=10, choices=Kind.choices, default=Kind.COHOST)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tournament", "user"], name="uniq_tournament_role")
        ]

    def __str__(self) -> str:
        return f"{self.user} — {self.role} of {self.tournament_id}"


class Entrant(TimeStampedModel):
    """
    A participant in ONE tournament — a single player or a generated team.

    `label` is the per-event nickname: the [Pig Benis] half of the identity
    model. `players` is the (Brett) half and may be empty for an ad-hoc name
    typed in with no roster entry behind it.
    """

    tournament = models.ForeignKey(Tournament, related_name="entrants", on_delete=models.CASCADE)
    label = models.CharField(max_length=80)
    players = models.ManyToManyField(Player, blank=True, related_name="entrants")
    seed = models.IntegerField(null=True, blank=True)
    joined_round = models.IntegerField(
        default=0, help_text="0 for an original entrant; >0 marks a late entry."
    )
    replaced_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="replaces",
        on_delete=models.SET_NULL,
        help_text="Substitution (plan §4, NEW 11): the slot persists, the person in it changes.",
    )
    eliminated = models.BooleanField(default=False)

    class Meta:
        ordering = ["seed", "label"]
        indexes = [models.Index(fields=["tournament", "seed"])]

    def __str__(self) -> str:
        return self.label


class Participation(TimeStampedModel):
    """
    Links an entrant to a real account, and records that account's consent.

    Only created for entrants backed by a user. It is what lets a player see
    events they have been added to and leave one, so nobody can attach stats to
    someone's account with no recourse (plan §8). Cheap now, painful to retrofit.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        LEFT = "left", "Left"
        DISPUTED = "disputed", "Disputed"

    entrant = models.ForeignKey(Entrant, related_name="participations", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="participations", on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["entrant", "user"], name="uniq_entrant_participation")
        ]

    def __str__(self) -> str:
        return f"{self.user} in {self.entrant} ({self.status})"


class Match(TimeStampedModel):
    """
    A node in the tournament's match graph.

    `best_of` lives on the match, not the tournament, because real events run
    Bo1 early, Bo3 in semis and Bo5 in the final (plan §3). Generation seeds it
    from the tournament's per-round defaults; the host can override any single
    match afterwards.

    `score` holds series wins — {"a": 2, "b": 1} — and the match resolves when a
    side reaches `wins_needed`.
    """

    class Bracket(models.TextChoices):
        MAIN = "main", "Main"
        LOSERS = "losers", "Losers"
        FINAL = "final", "Grand final"
        THIRD = "third", "Third place"

    BEST_OF_CHOICES = [(1, "Bo1"), (3, "Bo3"), (5, "Bo5"), (7, "Bo7")]

    tournament = models.ForeignKey(Tournament, related_name="matches", on_delete=models.CASCADE)
    round_no = models.IntegerField(validators=[MinValueValidator(0)])
    position = models.IntegerField(validators=[MinValueValidator(0)])
    bracket = models.CharField(max_length=8, choices=Bracket.choices, default=Bracket.MAIN)

    # Null until an entrant is pushed in from a previous round, or forever in a
    # bye. related_name="+" on all three: they are traversed from the match, and
    # three reverse accessors on Entrant would be noise.
    a = models.ForeignKey(
        Entrant, null=True, blank=True, related_name="+", on_delete=models.CASCADE
    )
    b = models.ForeignKey(
        Entrant, null=True, blank=True, related_name="+", on_delete=models.CASCADE
    )
    winner = models.ForeignKey(
        Entrant, null=True, blank=True, related_name="+", on_delete=models.SET_NULL
    )

    best_of = models.IntegerField(default=1, choices=BEST_OF_CHOICES)
    score = models.JSONField(default=dict, blank=True)

    # The advancement edges. Generated with the graph, then followed on every
    # reported result. `next_match_lose` is what makes double elimination work
    # without a second code path.
    next_match_win = models.ForeignKey(
        "self", null=True, blank=True, related_name="+", on_delete=models.SET_NULL
    )
    next_match_lose = models.ForeignKey(
        "self", null=True, blank=True, related_name="+", on_delete=models.SET_NULL
    )

    reported_at = models.DateTimeField(null=True, blank=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="reported_matches",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["bracket", "round_no", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "bracket", "round_no", "position"],
                name="uniq_match_slot",
            )
        ]
        indexes = [models.Index(fields=["tournament", "round_no"])]
        verbose_name_plural = "matches"

    def __str__(self) -> str:
        return f"{self.tournament_id} R{self.round_no}.{self.position} ({self.bracket})"

    @property
    def wins_needed(self) -> int:
        """Series wins required to take the match — 1 for Bo1, 2 for Bo3, 3 for Bo5."""
        return self.best_of // 2 + 1

    @property
    def is_ready(self) -> bool:
        """True once both slots are filled and the match can actually be played."""
        return self.a_id is not None and self.b_id is not None


class FFAResult(TimeStampedModel):
    """
    One entrant's placement in a free-for-all lobby.

    FFA rounds are not head-to-head, so they do not fit Match's a/b shape: a
    lobby of six produces six placements. The Match row represents the lobby and
    these rows carry the finishing order (plan §3).
    """

    match = models.ForeignKey(Match, related_name="ffa_results", on_delete=models.CASCADE)
    entrant = models.ForeignKey(Entrant, related_name="ffa_results", on_delete=models.CASCADE)
    placement = models.IntegerField(validators=[MinValueValidator(1)])
    points = models.FloatField(default=0)

    class Meta:
        ordering = ["match", "placement"]
        constraints = [
            models.UniqueConstraint(fields=["match", "entrant"], name="uniq_ffa_result_per_entrant")
        ]

    def __str__(self) -> str:
        return f"{self.entrant} #{self.placement}"


class Rating(TimeStampedModel):
    """
    A player's Elo in one game mode (plan §4, NEW 1).

    This is the piece that makes the product one thing rather than three tools
    sharing a domain: results sharpen ratings, ratings drive balanced team
    generation, and fairer teams make more games worth playing.
    """

    player = models.ForeignKey(Player, related_name="ratings", on_delete=models.CASCADE)
    mode = models.ForeignKey(GameMode, related_name="ratings", on_delete=models.CASCADE)
    elo = models.FloatField(default=1200)
    games = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)

    class Meta:
        ordering = ["-elo"]
        constraints = [
            models.UniqueConstraint(fields=["player", "mode"], name="uniq_rating_per_mode")
        ]
        indexes = [models.Index(fields=["mode", "-elo"])]

    def __str__(self) -> str:
        return f"{self.player} — {self.mode}: {self.elo:.0f}"


class TeamDraft(TimeStampedModel):
    """
    A captain draft: the phase between "tournament created" and "bracket exists".

    Captains take turns picking from a shared pool until it is empty, and only
    then are Entrants created and the match graph generated. That ordering is
    the whole design: the existing generator takes a list of entrants and knows
    nothing about how they were formed, so a draft is a *seeding phase* rather
    than a sixth format. Every format stays available — a drafted set of teams
    can feed single elimination, double, round robin, Swiss or FFA without the
    bracket code changing at all.

    Deliberately NOT called a "draft tournament". `Tournament.State.DRAFT`
    already means "created but not started", which is a different idea entirely;
    the state added for this is `DRAFTING`, and the two are easy to confuse when
    skimming. Read `state == "draft"` as "not started yet", never as "a player
    draft is running".

    Why a model rather than a blob in `Tournament.settings`: picks reference
    real Players, the pool has to be queried to render the page, and a
    half-finished draft must be resumable after a refresh. A JSON blob gives up
    foreign-key integrity on every one of those.
    """

    class CaptainMode(models.TextChoices):
        RANDOM = "random", "Randomised captains"
        MANUAL = "manual", "Chosen captains"

    tournament = models.OneToOneField(
        Tournament, related_name="team_draft", on_delete=models.CASCADE
    )
    team_count = models.PositiveSmallIntegerField(validators=[MinValueValidator(2)])
    captain_mode = models.CharField(
        max_length=8, choices=CaptainMode.choices, default=CaptainMode.RANDOM
    )

    # The pick order, as team indexes into `teams`. Generated once when the
    # draft opens and never recomputed: a host who refreshes mid-draft must see
    # the same order they did before, and re-randomising would silently change
    # whose turn it is.
    pick_order = models.JSONField(
        default=list,
        blank=True,
        help_text="Team indexes in the order they pick, one full cycle per round.",
    )
    picks_made = models.PositiveSmallIntegerField(
        default=0, help_text="How far through `pick_order` the draft has got."
    )

    # Accounts belonging to people named in the pool, so a friend who is being
    # drafted can watch the lobby from their own device.
    #
    # A denormalised list rather than a join, because the thing it has to answer
    # — "may this user see this draft?" — runs inside the tournament list's
    # queryset, and `settings.draft_pool` is bare strings with nothing to join
    # against. Captains are covered separately by `DraftTeam.captain_user`;
    # this is only the people still waiting to be picked.
    #
    # Written once when the draft opens and never updated: the pool is fixed at
    # that moment, so there is no second copy to drift out of sync with.
    pool_user_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="User ids of linked accounts in the draft pool. Visibility only.",
    )

    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Draft for {self.tournament_id} ({self.team_count} teams)"

    @property
    def is_complete(self) -> bool:
        return self.completed_at is not None

    @property
    def current_team_index(self) -> int | None:
        """Whose turn it is, or None when every pick has been made."""
        if self.picks_made >= len(self.pick_order):
            return None
        return self.pick_order[self.picks_made]


class DraftTeam(TimeStampedModel):
    """
    One side being assembled, and the captain assembling it.

    `captain_user` is set when the captain's roster entry is a linked account.
    Nothing in the local draft reads it — the host taps every pick — but it is
    what lets a second pass hand that person their own turn over a socket
    without a migration. Recording it now is close to free; retrofitting it
    later means reshaping rows that already exist.
    """

    draft = models.ForeignKey(TeamDraft, related_name="teams", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(help_text="0-based index into the pick order.")
    label = models.CharField(max_length=80, blank=True)

    captain = models.ForeignKey(
        Player,
        null=True,
        blank=True,
        related_name="captained_draft_teams",
        on_delete=models.SET_NULL,
    )
    captain_label = models.CharField(
        max_length=80,
        help_text="The captain's name as typed, so an anonymous draft still reads correctly.",
    )
    captain_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="captained_drafts",
        on_delete=models.SET_NULL,
        help_text="Set when the captain is a linked account. Unused until live drafting lands.",
    )

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["draft", "position"], name="uniq_draft_team_position")
        ]

    def __str__(self) -> str:
        return self.label or f"{self.captain_label}'s team"


class DraftPick(TimeStampedModel):
    """
    One player taken off the pool by one team.

    Stored as rows rather than as an array on the team so the pool is a query
    (`everyone not yet picked`) rather than a set difference maintained by hand
    — the kind of bookkeeping that drifts the moment a pick is undone.
    """

    draft = models.ForeignKey(TeamDraft, related_name="picks", on_delete=models.CASCADE)
    team = models.ForeignKey(DraftTeam, related_name="picks", on_delete=models.CASCADE)

    player = models.ForeignKey(
        Player,
        null=True,
        blank=True,
        related_name="draft_picks",
        on_delete=models.SET_NULL,
    )
    label = models.CharField(max_length=80, help_text="The picked name as typed.")

    # The pick's place in the overall order, so an undo knows what to roll back
    # to and the page can replay the draft in sequence.
    ordinal = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["ordinal"]
        constraints = [
            models.UniqueConstraint(fields=["draft", "ordinal"], name="uniq_draft_pick_ordinal")
        ]

    def __str__(self) -> str:
        return f"{self.label} to {self.team_id}"
