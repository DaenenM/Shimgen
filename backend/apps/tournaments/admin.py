from django.contrib import admin

from .models import (
    Entrant,
    FFAResult,
    Match,
    Participation,
    Rating,
    Role,
    TeamGenerationConstraint,
    Tournament,
)


class EntrantInline(admin.TabularInline):
    model = Entrant
    extra = 0
    fields = ("label", "seed", "joined_round", "eliminated")
    show_change_link = True


class RoleInline(admin.TabularInline):
    model = Role
    extra = 0
    raw_id_fields = ("user",)


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("__str__", "format", "state", "group", "public_slug", "created_at")
    list_filter = ("format", "state")
    search_fields = ("title", "public_slug", "group__name")
    raw_id_fields = ("group", "mode", "season", "created_by")
    # Generated in save(); editing either by hand would break existing links.
    readonly_fields = ("public_slug", "claim_token")
    inlines = [EntrantInline, RoleInline]


@admin.register(Entrant)
class EntrantAdmin(admin.ModelAdmin):
    list_display = ("label", "tournament", "seed", "joined_round", "eliminated")
    search_fields = ("label",)
    raw_id_fields = ("tournament", "replaced_by")
    filter_horizontal = ("players",)


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("__str__", "a", "b", "winner", "best_of", "reported_at")
    list_filter = ("bracket", "best_of")
    # Every FK here points at a table that grows per tournament, so raw ids
    # keep the change form from loading thousands of rows into selects.
    raw_id_fields = (
        "tournament",
        "a",
        "b",
        "winner",
        "next_match_win",
        "next_match_lose",
        "reported_by",
    )


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("player", "mode", "elo", "games", "wins", "losses")
    search_fields = ("player__display_name",)
    raw_id_fields = ("player", "mode")


admin.site.register([Participation, FFAResult, Role, TeamGenerationConstraint])

# Branding for the /admin/ dashboard.
admin.site.site_header = "shim.gg administration"
admin.site.site_title = "shim.gg"
admin.site.index_title = "Operations"
