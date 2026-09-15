"""
WebSocket URL routing.

One consumer so far: the captain-draft lobby, which is the screen where several
people watch the same state change every few seconds and polling reads worst.
Live bracket updates (plan §4, NEW 3) register here the same way when they land.

The `ws/` prefix matches the Vite dev proxy's own `/ws` entry, so a socket opened
against the dev server on :5173 is forwarded to Django on :8000 without the
client knowing the difference.
"""

from django.urls import path

from apps.tournaments.consumers import DraftConsumer, TournamentConsumer

websocket_urlpatterns = [
    path("ws/drafts/<int:tournament_id>/", DraftConsumer.as_asgi()),
    path("ws/tournaments/<int:tournament_id>/", TournamentConsumer.as_asgi()),
]
