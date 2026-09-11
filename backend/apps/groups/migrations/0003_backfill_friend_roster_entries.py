"""
Seed roster entries for friendships accepted before the sync existed.

`sync_roster_entry` runs when a request is accepted, so it does nothing for the
friendships that already existed — which is everybody's, on the day this ships.
Without this backfill the feature looks broken to exactly the people most likely
to try it: anyone who already has friends.

Deliberately forward-only. The reverse would have to delete roster entries, and
there is no way to tell one this created from one somebody has since renamed,
archived or played a tournament with. Leaving them is harmless; guessing is not.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Friendship = apps.get_model("accounts", "Friendship")
    Player = apps.get_model("groups", "Player")

    # The historical model has no `accepted()` queryset or `name` property, so
    # both are spelled out here rather than imported from the live model.
    ACCEPTED = "accepted"

    for friendship in Friendship.objects.filter(status=ACCEPTED).select_related(
        "from_user", "to_user"
    ):
        pairs = (
            (friendship.from_user, friendship.to_user),
            (friendship.to_user, friendship.from_user),
        )

        for owner, friend in pairs:
            if owner is None or friend is None:
                continue

            name = friend.display_name or friend.username

            if Player.objects.filter(owner=owner, user=friend).exists():
                continue

            # Adopt a hand-typed entry rather than adding a near-duplicate —
            # the same rule the live sync follows.
            existing = (
                Player.objects.filter(owner=owner, user__isnull=True, display_name__iexact=name)
                .order_by("id")
                .first()
            )

            if existing is not None:
                existing.user = friend
                existing.display_name = name
                existing.save(update_fields=["user", "display_name", "updated_at"])
            else:
                Player.objects.create(owner=owner, display_name=name, user=friend)


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0002_remove_group_members_remove_group_owner_and_more"),
        ("accounts", "0003_alter_user_username_user_uniq_username_ci"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
