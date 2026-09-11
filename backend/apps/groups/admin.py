from django.contrib import admin

from .models import Game, GameMode, Player


class GameModeInline(admin.TabularInline):
    model = GameMode
    extra = 1


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("display_name", "owner", "user", "last_used_at", "archived")
    list_filter = ("archived",)
    search_fields = ("display_name", "owner__email", "user__email")
    raw_id_fields = ("owner", "user")


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    # A null group marks a global preset; this filter separates the two.
    search_fields = ("name",)
    inlines = [GameModeInline]


@admin.register(GameMode)
class GameModeAdmin(admin.ModelAdmin):
    list_display = ("game", "name", "is_team_based")
    list_filter = ("is_team_based",)
    search_fields = ("name", "game__name")
