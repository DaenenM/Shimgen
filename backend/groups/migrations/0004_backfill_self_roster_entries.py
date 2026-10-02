"""
Put existing account holders on their own saved roster.

`sync_self_roster_entry` runs when an account is created, so it does nothing for
the accounts that already exist — which is everybody's, on the day this ships.
Without the backfill the feature is invisible to every current user, which is
the same gap the friend backfill closed.

Forward-only, for the same reason as that one: reversing would mean deleting
roster rows, and there is no way to tell one this created from one somebody has
since renamed, archived, or played a tournament with.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Player = apps.get_model("groups", "Player")

    for user in User.objects.all():
        # The historical model has no `name` property.
        name = user.display_name or user.username

        if Player.objects.filter(owner=user, user=user).exists():
            continue

        # Adopt a hand-typed row rather than adding a near-duplicate — the same
        # rule the live sync follows.
        existing = (
            Player.objects.filter(owner=user, user__isnull=True, display_name__iexact=name)
            .order_by("id")
            .first()
        )

        if existing is not None:
            existing.user = user
            existing.display_name = name
            existing.save(update_fields=["user", "display_name", "updated_at"])
        else:
            Player.objects.create(owner=user, display_name=name, user=user)


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0003_backfill_friend_roster_entries"),
        ("accounts", "0003_alter_user_username_user_uniq_username_ci"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
