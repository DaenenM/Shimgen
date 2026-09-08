"""Routes for groups, rosters and the game catalogue."""

from rest_framework.routers import DefaultRouter

from .views import (
    GameModeViewSet,
    GameViewSet,
    GroupViewSet,
    PlayerViewSet,
    SeasonViewSet,
)

app_name = "groups"

router = DefaultRouter()
router.register("groups", GroupViewSet, basename="group")
router.register("players", PlayerViewSet, basename="player")
router.register("games", GameViewSet, basename="game")
router.register("modes", GameModeViewSet, basename="mode")
router.register("seasons", SeasonViewSet, basename="season")

urlpatterns = router.urls
