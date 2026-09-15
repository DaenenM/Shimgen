"""
Live updates for a captain draft and for a bracket in progress.

Both exist for the same reason: several people watch one screen's worth of state
and change it from different devices. A co-host reports a result on their phone
and the host's laptop has no idea until they navigate away and back — which is
the workaround people actually find, and it is a bad one.

Nothing here decides anything. The REST endpoints remain the only way to change
a tournament; these push a notification that something did. That split is what
keeps a socket from becoming a second, subtly different implementation of the
rules — the failure mode that makes live features untrustworthy.

The two consumers differ in what they send, and deliberately:

  - A draft sends its whole payload. It is small, and every viewer of a lobby
    is entitled to exactly the same view of it.
  - A bracket sends a bare nudge and lets each client refetch. The detail
    payload carries every match, entrant, role and player — too big to push on
    every click — and a spectator and a host are entitled to *different*
    serializations of it, so one broadcast blob would either leak what a
    spectator should not see or under-serve the host.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class DraftConsumer(AsyncJsonWebsocketConsumer):
    """
    One tournament's draft lobby.

    Clients receive `{"type": "draft.update", "draft": {...}}` whenever a pick,
    an undo or a completion commits, plus one on connect so a late arrival does
    not sit blank until somebody moves.

    Read-only by design: messages from the client are ignored. Picking over the
    socket would mean duplicating `CanPickInDraft` and the turn check here, and
    two copies of a permission rule is how one of them ends up wrong.
    """

    async def connect(self):
        self.tournament_id = self.scope["url_route"]["kwargs"]["tournament_id"]
        self.group_name = f"draft.{self.tournament_id}"

        payload = await self._readable_draft()

        # 4403 rather than a silent accept-then-close: the client can tell a
        # refusal from a dropped connection and stop retrying.
        if payload is None:
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # The current state immediately, so the page renders from the socket
        # rather than racing its own initial fetch.
        await self.send_json({"type": "draft.update", "draft": payload})

    async def disconnect(self, code):
        # `group_name` is unset if connect() refused before joining.
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """Deliberately inert — every change goes through the REST endpoints."""

    async def draft_update(self, event):
        """Fan-out handler. Named for the `draft.update` type sent by the view."""
        await self.send_json({"type": "draft.update", "draft": event["draft"]})

    @database_sync_to_async
    def _readable_draft(self):
        """
        This viewer's draft payload, or None if they may not see it.

        Serialised here rather than in the broadcast so each socket gets the
        view its own account is entitled to, and so a viewer who connects mid
        draft sees the same shape the REST endpoint returns.
        """
        from .models import Tournament
        from .serializers import TeamDraftSerializer

        tournament = (
            Tournament.objects.filter(pk=self.tournament_id)
            .select_related("team_draft")
            .prefetch_related("team_draft__teams", "team_draft__picks")
            .first()
        )

        if tournament is None:
            return None

        draft = getattr(tournament, "team_draft", None)
        if draft is None:
            return None

        if not _may_watch_draft(tournament, draft, self.scope.get("user")):
            return None

        return TeamDraftSerializer(draft).data


class TournamentConsumer(AsyncJsonWebsocketConsumer):
    """
    One tournament's bracket, for everyone watching it.

    Sends `{"type": "tournament.update"}` — a nudge with no payload — whenever a
    result is reported or cleared, a round is paired, an entrant changes or the
    tournament starts. The client refetches through its normal query, which is
    what keeps each viewer's serialization its own.

    A nudge rather than the data is the whole design here. Pushing the detail
    payload would mean serialising a 28-match double elimination on every click
    and sending it to every viewer, and it would flatten the difference between
    what a host may see and what a spectator may.
    """

    async def connect(self):
        self.tournament_id = self.scope["url_route"]["kwargs"]["tournament_id"]
        self.group_name = f"tournament.{self.tournament_id}"

        if not await self._may_watch():
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """Deliberately inert — reporting goes through the REST endpoints."""

    async def tournament_update(self, event):
        """Fan-out handler for `tournament.update`."""
        await self.send_json({"type": "tournament.update"})

    @database_sync_to_async
    def _may_watch(self) -> bool:
        """
        Whether this viewer may watch this bracket at all.

        Deliberately broader than the draft rule: a bracket is publicly
        spectatable by design (plan §4, NEW 2) — nine friends open the link and
        none of them have an account — so anyone who can name the tournament may
        watch it change. What they *see* is still decided by the serializer on
        their own refetch, which is the point of sending a nudge rather than
        data.
        """
        from .models import Tournament

        return Tournament.objects.filter(pk=self.tournament_id).exists()


def _may_watch_draft(tournament, draft, user) -> bool:
    """
    Whether `user` may watch this draft.

    Mirrors the `drafting` clause in `TournamentViewSet.get_queryset`. Kept as a
    function next to the consumer rather than reaching into the viewset, because
    the queryset expresses it as SQL over the whole table and this needs the
    same question answered about one row.
    """
    from apps.common.permissions import is_unclaimed

    # An unclaimed quick-start draft belongs to whoever is holding it — the same
    # bargain every other anonymous path strikes (plan §4, NEW 6).
    if is_unclaimed(tournament):
        return True

    if user is None or not user.is_authenticated:
        return False

    if tournament.created_by_id == user.id:
        return True

    if tournament.roles.filter(user=user).exists():
        return True

    if draft.teams.filter(captain_user=user).exists():
        return True

    return user.id in (draft.pool_user_ids or [])
