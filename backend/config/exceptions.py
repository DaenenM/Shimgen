"""
A single error shape for the whole API.

DRF's default handler returns a different JSON shape depending on what raised:
a bare list for a ValidationError, `{"detail": ...}` for a permission failure, a
dict keyed by field name for a serializer. The React client would need a branch
for each. This handler normalises all of them into one envelope:

    {"error": {"code": "validation_error",
               "message": "...",
               "details": {"field": ["..."]}}}

so the frontend can read `error.message` for a toast and `error.details` for
per-field messages, every time.
"""

import logging

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# Maps an HTTP status onto the stable machine-readable code the client matches on.
CODES = {
    status.HTTP_400_BAD_REQUEST: "validation_error",
    status.HTTP_401_UNAUTHORIZED: "not_authenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_429_TOO_MANY_REQUESTS: "throttled",
}


def api_exception_handler(exc, context):
    """Return every API error in the envelope described in the module docstring."""
    # Django-level exceptions DRF understands only after translation.
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()
    elif isinstance(exc, IntegrityError):
        # A race that slipped past a serializer's uniqueness check — a duplicate
        # friend request, two hosts claiming the same slug. 409 says "retry",
        # which is true here, where a 500 would wrongly suggest a server fault.
        logger.warning("IntegrityError surfaced to the API layer: %s", exc)
        exc = exceptions.APIException(detail="Conflict with existing data.")
        exc.status_code = status.HTTP_409_CONFLICT

    response = drf_exception_handler(exc, context)
    if response is None:
        # Not a DRF exception: let Django's own handler produce the 500 so
        # error reporting and DEBUG tracebacks keep working as normal.
        return None

    code = getattr(exc, "default_code", None) or CODES.get(response.status_code, "error")
    detail = response.data

    if isinstance(detail, dict) and set(detail) == {"detail"}:
        # A plain {"detail": "..."} — the message is the whole error.
        message, details = str(detail["detail"]), {}
    elif isinstance(detail, dict):
        # Field errors from a serializer.
        message, details = "Validation failed.", detail
    elif isinstance(detail, list):
        # A ValidationError raised with a bare list of messages.
        message = str(detail[0]) if detail else "Request failed."
        details = {"non_field_errors": detail}
    else:
        message, details = str(detail), {}

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
