from django.contrib import admin

from .models import Game, GameMode, Group, Membership, Player, Season


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    raw_id_fields = ("user",)


class GameModeInline(admin.TabularInline):
    model = GameMode
    extra = 1


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner", "created_at")
    search_fields = ("name", "slug", "owner__email")
    prepopulated_fields = {"slug": ("name",)}
    raw_id_fields = ("owner",)
    inlines = [MembershipInline]


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("display_name", "owner", "group", "user", "last_used_at", "archived")
    list_filter = ("archived",)
    search_fields = ("display_name", "owner__email", "user__email")
    raw_id_fields = ("owner", "group", "user")


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "slug")
    # A null group marks a global preset; this filter separates the two.
    list_filter = ("group",)
    search_fields = ("name",)
    inlines = [GameModeInline]


@admin.register(GameMode)
class GameModeAdmin(admin.ModelAdmin):
    list_display = ("game", "name", "is_team_based")
    list_filter = ("is_team_based",)
    search_fields = ("name", "game__name")


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "starts_on", "ends_on", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "group__name")
    raw_id_fields = ("group",)
