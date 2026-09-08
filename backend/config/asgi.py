"""
ASGI entrypoint — serves both HTTP and WebSocket.

Live bracket updates arrive over WebSocket, so ASGI is the real production
server here, not a nicety. Routing is empty until the first consumer exists; the
plumbing is in place so adding one is a single line in config/routing.py.
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Initialise Django before importing anything that touches models — consumers
# and the auth middleware both do, and importing them earlier raises
# AppRegistryNotReady.
django_asgi_app = get_asgi_application()

from config.routing import websocket_urlpatterns  # noqa: E402
from config.ws_auth import JWTAuthMiddlewareStack  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # AllowedHostsOriginValidator rejects WebSocket handshakes whose Origin
        # is not in ALLOWED_HOSTS. Browsers do not apply the same-origin policy
        # to WebSockets, so without this any site could open a socket as a
        # logged-in user.
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
