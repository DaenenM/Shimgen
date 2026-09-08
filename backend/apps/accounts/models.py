"""
Accounts and the friend graph.

A custom user model is defined here from the very first migration. Swapping
AUTH_USER_MODEL after tables exist is one of the few genuinely painful
migrations in Django, so it is done up front even though User adds little
to AbstractUser today.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.common.models import TimeStampedModel

from .managers import UserManager


class User(AbstractUser):
    """
    A registered account.

    Email is the login identifier: people forget which username they picked
    across a year of Saturdays, and they never forget their email. `username`
    is kept as the public display handle rather than removed, because
    django.contrib.admin and a number of third-party packages still expect it.
    """

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

    def __str__(self) -> str:
        return self.display_name or self.username

    @property
    def name(self) -> str:
        """The name to render for this user anywhere in the UI."""
        return self.display_name or self.username


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
