"""
Accounts and the friend graph.

A custom user model is defined here from the very first migration. Swapping
AUTH_USER_MODEL after tables exist is one of the few genuinely painful
migrations in Django, so it is done up front even though User adds little
to AbstractUser today.
"""

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower

from apps.common.models import TimeStampedModel

from .managers import UserManager

# Letters, digits and underscore only — no dots, no @, no plus.
#
# Django's default username validator allows `@ . + - _`, which was harmless
# while nobody could change their username. Now that anyone can, it is not:
# friend requests are addressed by username, and a handle containing `@` lets
# somebody claim a string that looks exactly like another person's email
# address. Narrowing the charset is what keeps a handle unmistakably a handle.
HANDLE = RegexValidator(
    regex=r"^[A-Za-z0-9_]+$",
    message="Usernames can only contain letters, numbers and underscores.",
)


class User(AbstractUser):
    """
    A registered account.

    Email is the login identifier: people forget which username they picked
    across a year of Saturdays, and they never forget their email. `username`
    is the public **handle** — the `@name` somebody types to send a friend
    request — which is why it is unique and `display_name` is not. Two people
    called "Shim" is fine; two people answering to `@shim` is not.
    """

    username = models.CharField(
        max_length=30,
        unique=True,
        validators=[HANDLE],
        help_text="Your @handle. Letters, numbers and underscores only.",
        error_messages={"unique": "That username is taken."},
    )
    email = models.EmailField(unique=True)
    display_name = models.CharField(
        max_length=60,
        blank=True,
        help_text="Shown on profiles and leaderboards. Falls back to username.",
    )
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    # Google's stable subject id. Matched on before email, because a Google
    # account can change its address while `sub` never changes — keying on
    # email alone would silently create a duplicate account when someone
    # renames their Gmail.
    google_sub = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    avatar_url = models.URLField(
        blank=True,
        help_text="Profile picture from a social login, when there is no uploaded avatar.",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    # Prompted for by createsuperuser on top of USERNAME_FIELD and password.
    # Empty because UserManager derives a username from the email when one is
    # not given, so createsuperuser needs nothing beyond an email and password.
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["username"]
        constraints = [
            # `unique=True` is case-sensitive, so without this `Shim` and `shim`
            # could both exist — and since a handle is matched case-insensitively
            # when a request is addressed to it, whichever was found first would
            # get the friend request. An ambiguous handle is worse than none.
            models.UniqueConstraint(Lower("username"), name="uniq_username_ci"),
        ]

    def __str__(self) -> str:
        return self.display_name or self.username

    @property
    def name(self) -> str:
        """The name to render for this user anywhere in the UI."""
        return self.display_name or self.username


def sync_roster_entry(owner, friend):
    """
    Give `owner` a roster entry for `friend`, linked to their account.

    Accepting a friend request is the clearest possible statement that you play
    with somebody, and retyping their name afterwards is exactly the friction
    the saved roster exists to remove (plan §3).

    Matched on the account rather than the name, so this is idempotent: a second
    accept, or a rename, updates the row it already owns instead of adding a
    near-duplicate. An unlinked entry that happens to share the name is adopted
    rather than duplicated — that is almost always the same person, typed by
    hand before the accounts were connected.
    """
    from apps.groups.models import Player

    entry = Player.objects.filter(owner=owner, user=friend).first()

    if entry is None:
        entry = (
            Player.objects.filter(owner=owner, user__isnull=True, display_name__iexact=friend.name)
            .order_by("id")
            .first()
        )

    if entry is None:
        return Player.objects.create(owner=owner, display_name=friend.name, user=friend)

    # `display_name` stays a stored column rather than being derived at read
    # time: the bulk importer de-duplicates against it, and a tournament
    # resolves a roster entry by it, so a stale column would let a duplicate in.
    # Re-syncing on the two events that can change it keeps it truthful.
    changed = []
    if entry.user_id != friend.id:
        entry.user = friend
        changed.append("user")
    if entry.display_name != friend.name:
        entry.display_name = friend.name
        changed.append("display_name")

    if changed:
        entry.save(update_fields=[*changed, "updated_at"])

    return entry


def friend_ids_for(user) -> frozenset:
    """
    The accounts `user` is friends with, as a set of ids.

    Resolved once per request and handed to serializers through their context:
    asking per row would be a query for every name on a board or a roster, which
    is exactly the pages that show all of them at once.
    """
    if not getattr(user, "is_authenticated", False):
        return frozenset()

    accepted = Friendship.objects.accepted().involving(user)

    return frozenset(
        row.to_user_id if row.from_user_id == user.id else row.from_user_id
        for row in accepted.only("from_user_id", "to_user_id")
    )


def sync_self_roster_entry(user):
    """
    Put the account holder on their own saved roster.

    You are almost always in your own game night, and typing your own name into
    every bracket is the same friction the roster exists to remove. Having it as
    a real linked row rather than a rendered shortcut is what makes adding
    yourself attach your *account* — so the event lands on your profile exactly
    as it does for a friend.

    `sync_roster_entry` already does all of this; the owner and the person are
    simply the same user here.
    """
    return sync_roster_entry(user, user)


def sync_roster_entries_for(user):
    """
    Push `user`'s current name into every roster entry that is them.

    Called when somebody renames themselves. Scoped to accepted friendships, so
    renaming does not reach into the roster of anyone who merely has a request
    outstanding — plus the user's own roster, because their own entry is one of
    the rows that is them.

    That last part is easy to miss: `friend_ids` never contains the user, so
    without it a rename updated every friend's copy of you and left your own
    row on the old name. No early return for the friendless case either, for
    the same reason — an account with no friends still has itself.
    """
    from apps.groups.models import Player

    owner_ids = (
        set(
            Friendship.objects.accepted()
            .filter(from_user=user)
            .values_list("to_user_id", flat=True)
        )
        | set(
            Friendship.objects.accepted()
            .filter(to_user=user)
            .values_list("from_user_id", flat=True)
        )
        | {user.id}
    )

    return (
        Player.objects.filter(owner_id__in=owner_ids, user=user)
        .exclude(display_name=user.name)
        .update(display_name=user.name)
    )


class FriendshipQuerySet(models.QuerySet):
    def accepted(self):
        return self.filter(status=Friendship.Status.ACCEPTED)

    def involving(self, user):
        """Every friendship `user` is either side of, in any status."""
        return self.filter(models.Q(from_user=user) | models.Q(to_user=user))

    def between(self, user, other):
        """The friendship linking two people, whichever way it was sent."""
        return self.filter(
            models.Q(from_user=user, to_user=other) | models.Q(from_user=other, to_user=user)
        )


def are_friends(user, other) -> bool:
    """
    Whether these two have an accepted friendship.

    Handing someone permission over your bracket or your board is a real grant,
    so it is limited to people you have already linked accounts with — which is
    a mutual act, unlike knowing an email address.
    """
    if not getattr(user, "is_authenticated", False) or other is None:
        return False
    if user.id == other.id:
        return True

    return Friendship.objects.accepted().between(user, other).exists()


class Friendship(TimeStampedModel):
    """
    A directed friend request that becomes a mutual link once accepted.

    Direction is kept after acceptance rather than being normalised away,
    because it records who asked — useful when someone reviews their pending
    requests, and free to store.

    Friendship exists to serve cross-group stat continuity (plan §3): adding a
    friend to an event links the Entrant to their real account, so results
    accumulate to their profile even when someone else is hosting.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        BLOCKED = "blocked", "Blocked"

    from_user = models.ForeignKey(
        User, related_name="sent_friend_requests", on_delete=models.CASCADE
    )
    to_user = models.ForeignKey(
        User, related_name="received_friend_requests", on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True
    )

    objects = FriendshipQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["from_user", "to_user"], name="uniq_friendship_pair"),
            # Without this, a self-request is a valid row that would show up in
            # the requester's own pending list.
            models.CheckConstraint(
                condition=~models.Q(from_user=models.F("to_user")),
                name="no_self_friendship",
            ),
        ]
        indexes = [models.Index(fields=["to_user", "status"])]

    def __str__(self) -> str:
        return f"{self.from_user} → {self.to_user} ({self.status})"
