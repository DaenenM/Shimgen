"""
JWT authentication for WebSocket connections.

Channels ships AuthMiddlewareStack, which reads the session cookie. This SPA
authenticates with a Bearer token and sends no cookies, so that stack would see
every socket as anonymous.

Browsers cannot set headers on a WebSocket handshake, so the token arrives as a
query parameter instead: ws://host/ws/...?token=<access>. That places it in the
URL, where it can land in server logs, so keep access-token lifetimes short
(SIMPLE_JWT.ACCESS_TOKEN_LIFETIME) and never accept a refresh token here.

Anonymous connections are allowed through rather than rejected: spectator links
are public by design (plan §4, NEW 2), and it is each consumer's job to decide
what an unauthenticated viewer may see.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(raw_token: str):
    """Resolve an access token to a User, or AnonymousUser if it is not valid."""
    # Imported lazily: this module is imported from asgi.py, and simplejwt pulls
    # in models that are not ready until get_asgi_application() has run.
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

    authenticator = JWTAuthentication()
    try:
        validated = authenticator.get_validated_token(raw_token)
        return authenticator.get_user(validated)
    except (InvalidToken, TokenError, KeyError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Populate scope["user"] from a ?token= query parameter."""

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]

        scope["user"] = await _user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):  # noqa: N802 — mirrors Channels' own naming
    """Drop-in replacement for Channels' AuthMiddlewareStack, using JWTs."""
    return JWTAuthMiddleware(inner)
