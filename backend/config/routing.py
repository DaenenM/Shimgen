"""
WebSocket URL routing.

Empty until the first consumer ships. Live bracket updates (plan §4, NEW 3) will
register here as something like:

    path("ws/tournaments/<slug:public_slug>/", TournamentConsumer.as_asgi())
"""

websocket_urlpatterns: list = []
