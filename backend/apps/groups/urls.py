"""Routes for the player roster and saved teams."""

from rest_framework.routers import DefaultRouter

from .views import PlayerViewSet, SavedTeamViewSet

app_name = "groups"

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")
router.register("saved-teams", SavedTeamViewSet, basename="saved-team")

urlpatterns = router.urls
