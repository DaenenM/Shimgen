"""Pushing live updates to connected browsers over Channels."""

from django.db import transaction


def broadcast_draft(draft):
    """
    Push the draft's new state to everyone watching the lobby.

    Sent after the surrounding transaction commits, never inside it: a pick that
    is rolled back must not have already told six other screens it happened, and
    a broadcast from inside the transaction can also reach a listener that then
    reads the pre-commit state back from the database.

    Serialised once here rather than per-socket. Every viewer of a draft is
    entitled to the same payload — the lobby has nothing per-person in it — so
    fanning out one copy avoids re-serialising for each connection.

    Failures are swallowed. A draft whose socket layer is unavailable is still a
    perfectly good draft: the REST response has already returned the new state
    to whoever acted, and the others are one refresh behind rather than looking
    at a broken page.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    from ..serializers import TeamDraftSerializer

    payload = TeamDraftSerializer(draft).data

    def send():
        try:
            layer = get_channel_layer()
            if layer is None:
                return
            async_to_sync(layer.group_send)(
                f"draft.{draft.tournament_id}",
                {"type": "draft.update", "draft": payload},
            )
        except Exception:  # noqa: BLE001 — see below; the breadth is the point
            # Deliberately blind. The pick has already committed and its HTTP
            # response has gone back to whoever made it, so nothing raised here
            # can be usefully handled — and anything that escapes would turn a
            # successful pick into a 500. Narrowing this to Redis' own
            # exceptions would also miss whatever a different channel layer
            # raises, which is exactly the case worth surviving.
            pass

    transaction.on_commit(send)


def broadcast_tournament(tournament_id):
    """
    Tell everyone watching this bracket that something changed.

    A bare nudge, not the data. The detail payload is every match, entrant, role
    and player — serialising that on each click and pushing it to each viewer is
    real work for a page that mostly sits idle — and a host and a spectator are
    entitled to different serializations of it, so one broadcast blob would
    either leak or under-serve. Each client refetches through its own query and
    gets its own view.

    Sent after commit, and failures are swallowed, for the same reasons as
    `broadcast_draft`: a result that has already been written and returned must
    not be turned into a 500 by a channel layer that is unavailable.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    def send():
        try:
            layer = get_channel_layer()
            if layer is None:
                return
            async_to_sync(layer.group_send)(
                f"tournament.{tournament_id}",
                {"type": "tournament.update"},
            )
        except Exception:  # noqa: BLE001 — same reasoning as broadcast_draft
            pass

    transaction.on_commit(send)
