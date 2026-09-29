"""The tournament viewset: querying, permissions and creation.

Each group of extra actions lives in its own mixin module next to this one."""

from django.db import models, transaction
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import CanReportResults, IsTournamentHost

from ..models import Role, Tournament
from ..permissions import CanPickInDraft
from ..serializers import (
    CreateTournamentSerializer,
    TournamentDetailSerializer,
    TournamentSerializer,
)
from ..services.creation import (
    add_cohosts,
    create_entrants,
    create_team_entrants,
    generate_bracket,
    next_untitled_title,
    open_team_draft,
)
from ..services.stats_link import link_stats
from .tournament_bracket import BracketActionsMixin
from .tournament_cohosts import CohostActionsMixin
from .tournament_drafts import DraftActionsMixin
from .tournament_lifecycle import LifecycleActionsMixin
from .tournament_stats import StatsBoardActionsMixin


class TournamentViewSet(
    BracketActionsMixin,
    DraftActionsMixin,
    StatsBoardActionsMixin,
    CohostActionsMixin,
    LifecycleActionsMixin,
    viewsets.ModelViewSet,
):
    """Tournaments the signed-in user hosts, co-hosts or plays in."""

    serializer_class = TournamentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        # Every relation the detail serializer touches is pulled here. Without
        # the nested ones a bracket costs ~4 queries per match — each card asks
        # separately who A, B and the winner are, and who reported it — so a
        # 28-match double elimination ran 60+ round trips per render. They are
        # already in `entrants`; this just stops Django fetching them again.
        base = Tournament.objects.select_related(
            "mode",
            "created_by",
            # The list says whether deleting a row would touch a board, which is
            # one query per row without this. The detail page goes further and
            # names the board, so the table and board it hangs off are pulled
            # too — otherwise naming it costs two more queries per row than the
            # boolean ever did.
            "stats_link",
            "stats_link__table__board",
            "stats_link__column__table__board",
        ).prefetch_related(
            "entrants",
            "entrants__players",
            "roles",
            "roles__user",
            "matches__a",
            "matches__b",
            "matches__winner",
            "matches__reported_by",
        )

        # An unclaimed quick-start bracket has no owner, so an ownership filter
        # excludes it from its own creator. Without this the anonymous flow
        # creates a tournament and then 404s on the redirect to it — which is
        # the entire front door of the product (plan §4, NEW 6).
        #
        # Safe to expose: these have no owner to protect, and the id is only
        # known to whoever just made it or was handed the link. Anything
        # sensitive is gated by `can_report` / `is_host` on the serializer, and
        # writes still go through IsTournamentHost.
        #
        # Scoped to single-object actions only. Folding it into `list` would put
        # every stranger's unclaimed bracket in everyone's tournament list.
        unclaimed = models.Q(created_by__isnull=True)
        by_id = self.action not in ("list",)

        if not user.is_authenticated:
            return base.filter(unclaimed) if by_id else base.none()

        # A drafting tournament has no entrants yet — they are created when the
        # last pick lands — so the participation clause below cannot see it, and
        # a friend being drafted would find no lobby in their list until the
        # bracket already existed. Captains are matched by their own column;
        # everyone still in the pool by the ids recorded when the draft opened.
        drafting = models.Q(state=Tournament.State.DRAFTING) & (
            models.Q(team_draft__teams__captain_user=user)
            | models.Q(team_draft__pool_user_ids__contains=user.id)
        )

        mine = (
            models.Q(created_by=user)
            | models.Q(roles__user=user)
            | models.Q(entrants__participations__user=user)
            | drafting
        )

        queryset = base.filter(mine | unclaimed if by_id else mine).distinct()

        # Archived tournaments are hidden from the list but still reachable by
        # id, so a link to one keeps working and the page can offer to restore
        # it. `?archived=true` is what the list's own toggle asks for.
        if self.action == "list":
            wants_archived = self.request.query_params.get("archived") == "true"
            queryset = queryset.filter(archived=wants_archived)

        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return CreateTournamentSerializer
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentSerializer

    def get_permissions(self):
        # `create` is deliberately open: the no-account quick start is the whole
        # point of the front door (plan §4, NEW 6).
        if self.action in (
            "update",
            "partial_update",
            "destroy",
            # Undo rewrites somebody else's pick and completing ends the draft
            # outright, so both stay with the host. Picking is the exception
            # below: a captain takes their own turn.
            "draft_undo",
            "draft_complete",
        ):
            return [IsTournamentHost()]
        if self.action == "draft_pick":
            return [CanPickInDraft()]
        # Restaging creates a tournament owned by the caller, so it needs an
        # account to own it — the anonymous quick-start path has nowhere to put
        # the clone.
        if self.action == "restage":
            return [IsAuthenticated()]
        # `draft` is a read, and it has to stay open for the same reason the
        # bracket does: an anonymous quick-start host creates a captains
        # tournament and is redirected straight to its lobby. Gating it behind a
        # login meant they could build a draft and then not run it, which is the
        # no-account path broken at its last step (plan §4, NEW 6). What may be
        # *changed* is still gated — picking goes through CanPickInDraft, undo
        # and complete through IsTournamentHost.
        if self.action in ("list", "retrieve", "create", "standings", "draft"):
            return [AllowAny()]
        # Same rule as reporting one result: host, co-host or linked player —
        # and an unclaimed quick-start bracket stays reportable signed out, or
        # the no-account path could build a bracket and never run it.
        if self.action == "batch_report":
            return [CanReportResults()]
        return [IsAuthenticated()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        labels = serializer.validated_data.pop("entrant_labels", [])
        teams = serializer.validated_data.pop("entrant_teams", [])
        seeding = serializer.validated_data.pop("seeding", "random")

        tournament = serializer.save(
            created_by=request.user if request.user.is_authenticated else None
        )

        if not (tournament.title or "").strip():
            tournament.title = next_untitled_title(request.user)
            tournament.save(update_fields=["title", "updated_at"])

        if request.user.is_authenticated:
            Role.objects.create(tournament=tournament, user=request.user, role=Role.Kind.HOST)

        # A captain draft replaces entrant creation rather than following it:
        # who is on which team is not known yet, so there is nothing to seed.
        # The entrants appear when the draft completes (see draft_complete).
        draft_config = (serializer.validated_data.get("settings") or {}).get("team_draft")

        if draft_config:
            open_team_draft(tournament, labels, draft_config, request.user)
        elif teams:
            create_team_entrants(tournament, teams, request.user)
            generate_bracket(tournament, seeding)
        elif labels:
            create_entrants(tournament, labels, request.user)
            generate_bracket(tournament, seeding)

        add_cohosts(tournament, request.data.get("cohosts") or [], request.user)

        link_stats(
            tournament,
            request.data.get("stats_board"),
            request.data.get("stats_table"),
            request.data.get("stats_column"),
            request.user,
        )

        return Response(
            TournamentDetailSerializer(tournament, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
