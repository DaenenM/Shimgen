"""Infrastructure endpoints that belong to no application."""

from django.db import connection
from django.http import JsonResponse


def health(request):
    """
    Liveness and readiness probe for the platform's health check.

    It touches the database on purpose. A process that is running but cannot
    reach Postgres is not ready to serve traffic, and a check that only proves
    Python is alive would keep routing requests to it.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database = "ok"
        code = 200
    except Exception:  # noqa: BLE001 — the probe must report, never raise
        database = "unavailable"
        code = 503

    return JsonResponse(
        {"status": "ok" if code == 200 else "degraded", "database": database}, status=code
    )
