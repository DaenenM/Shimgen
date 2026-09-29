"""Routes for tournaments and spectating."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SpectatorStandingsView,
    SpectatorView,
    TournamentViewSet,
)

app_name = "tournaments"

router = DefaultRouter()
router.register("tournaments", TournamentViewSet, basename="tournament")

urlpatterns = [
    # Public, no account required — the spectator link is the acquisition
    # channel, so it sits outside the authenticated router.
    path("spectate/<slug:public_slug>/", SpectatorView.as_view(), name="spectate"),
    path(
        "spectate/<slug:public_slug>/standings/",
        SpectatorStandingsView.as_view(),
        name="spectate-standings",
    ),
    path("", include(router.urls)),
]
