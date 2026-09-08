"""Routes for stats boards."""

from rest_framework.routers import DefaultRouter

from .views import (
    StatsBoardViewSet,
    StatsColumnViewSet,
    StatsRowViewSet,
    StatsTableViewSet,
)

app_name = "stats"

router = DefaultRouter()
router.register("boards", StatsBoardViewSet, basename="board")
router.register("stats-tables", StatsTableViewSet, basename="stats-table")
router.register("stats-columns", StatsColumnViewSet, basename="stats-column")
router.register("stats-rows", StatsRowViewSet, basename="stats-row")

urlpatterns = router.urls
