"""Routes for groups, rosters and the game catalogue."""

from rest_framework.routers import DefaultRouter

from .views import GameModeViewSet, GameViewSet, PlayerViewSet

app_name = "groups"

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")
router.register("games", GameViewSet, basename="game")
router.register("modes", GameModeViewSet, basename="mode")

urlpatterns = router.urls
