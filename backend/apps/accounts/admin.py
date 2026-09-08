from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Friendship, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Django's UserAdmin, taught about the fields this project adds."""

    list_display = ("email", "username", "display_name", "is_staff", "date_joined")
    search_fields = ("email", "username", "display_name")
    ordering = ("email",)

    # BaseUserAdmin.fieldsets is keyed on the default User; extend rather than
    # replace so permissions and dates keep their existing sections.
    fieldsets = (
        *BaseUserAdmin.fieldsets,
        ("Profile", {"fields": ("display_name", "avatar")}),
    )
    add_fieldsets = (
        *BaseUserAdmin.add_fieldsets,
        ("Profile", {"fields": ("email", "display_name")}),
    )


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("from_user__email", "to_user__email")
    # Two FKs to a table that grows with every signup — raw ids keep the form
    # from rendering the entire user list in a select.
    raw_id_fields = ("from_user", "to_user")
