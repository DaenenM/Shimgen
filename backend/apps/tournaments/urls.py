"""Routes for tournaments, matches, spectating and the team generator."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    MatchViewSet,
    SpectatorStandingsView,
    SpectatorView,
    TeamGeneratorView,
    TournamentViewSet,
)

app_name = "tournaments"

router = DefaultRouter()
router.register("tournaments", TournamentViewSet, basename="tournament")
router.register("matches", MatchViewSet, basename="match")

urlpatterns = [
    # Public, no account required — the spectator link is the acquisition
    # channel, so it sits outside the authenticated router.
    path("spectate/<slug:public_slug>/", SpectatorView.as_view(), name="spectate"),
    path(
        "spectate/<slug:public_slug>/standings/",
        SpectatorStandingsView.as_view(),
        name="spectate-standings",
    ),
    path("teams/generate/", TeamGeneratorView.as_view(), name="team-generate"),
    path("", include(router.urls)),
]
