"""
Root URL configuration.

Every application route lives under /api/v1/ so a future breaking change can ship
as /api/v2/ alongside it rather than forcing every client to update at once.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from config.views import health

api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.groups.urls")),
    path("", include("apps.stats.urls")),
    path("", include("apps.tournaments.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", health, name="health"),
    path("api/v1/", include((api_v1, "v1"), namespace="v1")),
    # OpenAPI schema plus two readers for it. The schema is what generates the
    # frontend's typed API contract, so it is served in every environment.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    # In production the media directory is served by the web server or object
    # storage, not by Django.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
