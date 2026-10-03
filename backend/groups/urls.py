"""Routes for the player roster, saved teams and the game list."""

from rest_framework.routers import DefaultRouter

from .views import GameViewSet, PlayerViewSet, SavedTeamViewSet

app_name = "groups"

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")
router.register("saved-teams", SavedTeamViewSet, basename="saved-team")
router.register("games", GameViewSet, basename="game")

urlpatterns = router.urls
