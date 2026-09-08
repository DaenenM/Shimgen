"""Tournament endpoints: generation, reporting, spectating and claiming."""

import secrets

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import are_friends
from apps.common.permissions import CanReportResults, IsTournamentHost, _is_host, is_unclaimed
from apps.groups.models import Player

from .brackets.advance import ResultError, clear_result, report_result
from .brackets.double_elimination import generate_double_elimination
from .brackets.ffa import generate_ffa, next_ffa_round, report_ffa_result
from .brackets.round_robin import generate_round_robin
from .brackets.seeding import seed_entrants
from .brackets.single_elimination import generate_single_elimination
from .brackets.swiss import generate_swiss, pair_next_round
from .models import Entrant, Match, Participation, Role, Tournament
from .ratings import apply_match_result
from .serializers import (
    CreateTournamentSerializer,
    EntrantSerializer,
    MatchSerializer,
    ReportFFASerializer,
    ReportResultSerializer,
    SpectatorSerializer,
    TournamentDetailSerializer,
    TournamentSerializer,
)
from .standings import standings_payload
from .teams import TeamGenerationError, generate_teams


class TournamentViewSet(viewsets.ModelViewSet):
    """Tournaments the signed-in user hosts, co-hosts or plays in."""

    serializer_class = TournamentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        base = Tournament.objects.select_related("group", "mode", "created_by").prefetch_related(
            "entrants", "matches"
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
        unclaimed = models.Q(created_by__isnull=True, group__isnull=True)
        by_id = self.action not in ("list",)

        if not user.is_authenticated:
            return base.filter(unclaimed) if by_id else base.none()

        mine = (
            models.Q(created_by=user)
            | models.Q(roles__user=user)
            | models.Q(group__owner=user)
            | models.Q(group__memberships__user=user)
            | models.Q(entrants__participations__user=user)
        )

        return base.filter(mine | unclaimed if by_id else mine).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return CreateTournamentSerializer
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentSerializer

    def get_permissions(self):
        # `create` is deliberately open: the no-account quick start is the whole
        # point of the front door (plan §4, NEW 6), and an anonymous bracket is
        # protected by its claim token rather than by a login.
        if self.action in ("update", "partial_update", "destroy", "generate", "reset"):
            return [IsTournamentHost()]
        if self.action in ("list", "retrieve", "create", "claim", "standings"):
            return [AllowAny()]
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

        # An anonymous quick-start bracket gets a claim token so it can be
        # attached to an account later (plan §7, v1). Written after save rather
        # than passed to it: claim_token is not a serializer field, so save()
        # would silently drop the kwarg.
        if not request.user.is_authenticated:
            tournament.claim_token = secrets.token_hex(16)
            tournament.save(update_fields=["claim_token"])

        if request.user.is_authenticated:
            Role.objects.create(tournament=tournament, user=request.user, role=Role.Kind.HOST)

        if teams:
            _create_team_entrants(tournament, teams, request.user)
            _generate(tournament, seeding)
        elif labels:
            _create_entrants(tournament, labels, request.user)
            _generate(tournament, seeding)

        _add_cohosts(tournament, request.data.get("cohosts") or [], request.user)

        _link_stats(
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

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        """
        Build the match graph.

        Refuses once the tournament is active unless `force` is passed, because
        regenerating clears every reported result. The client asks for
        confirmation first (plan §8) rather than silently wiping the night.
        """
        tournament = self.get_object()

        if tournament.state != Tournament.State.DRAFT and not request.data.get("force"):
            raise ValidationError(
                "This tournament has already started. Regenerating clears every "
                "reported result — pass force to confirm."
            )

        tournament.matches.all().delete()
        _generate(tournament, request.data.get("seeding", "random"))

        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """Move from draft to active, locking the entrant list for brackets."""
        tournament = self.get_object()

        if not tournament.matches.exists():
            raise ValidationError("Generate the bracket before starting.")

        tournament.state = Tournament.State.ACTIVE
        tournament.started_at = timezone.now()
        tournament.save(update_fields=["state", "started_at", "updated_at"])

        return Response(self.get_serializer(tournament).data)

    @action(detail=True, methods=["get"])
    def standings(self, request, pk=None):
        """Computed from Match rows on every call — never stored."""
        return Response(standings_payload(self.get_object()))

    @action(detail=True, methods=["post"])
    def entrants(self, request, pk=None):
        """
        Add an entrant, honouring the late-join rules.

        An elimination bracket is a fixed tree: inserting a node means rebuilding
        it, which clears results. Rather than doing that silently, this refuses
        and tells the caller why (plan §3, §8).
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can add entrants.")

        if not tournament.accepts_late_entrants:
            raise ValidationError(
                "This bracket has already started and its shape is fixed. "
                "Regenerate it (clearing results) or add them to a future event."
            )

        serializer = EntrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        last_round = tournament.matches.aggregate(models.Max("round_no"))["round_no__max"] or 0
        entrant = serializer.save(
            tournament=tournament,
            # >0 marks a late entry, so standings can show they played fewer rounds.
            joined_round=0 if tournament.state == Tournament.State.DRAFT else last_round,
        )
        _link_participants(entrant)

        return Response(
            EntrantSerializer(entrant, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "entrant_id", int, OpenApiParameter.PATH, description="Entrant to replace."
            )
        ]
    )
    @action(detail=True, methods=["post"], url_path="entrants/(?P<entrant_id>[^/.]+)/substitute")
    def substitute(self, request, pk=None, entrant_id=None):
        """
        Swap the person in a slot, keeping the bracket and results intact
        (plan §4, NEW 11).

        The slot persists; only who occupies it changes. This is what happens
        when someone rage-quits or their internet dies mid-tournament.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can substitute entrants.")

        entrant = tournament.entrants.filter(pk=entrant_id).first()
        if entrant is None:
            raise ValidationError("No such entrant in this tournament.")

        label = request.data.get("label")
        if not label:
            raise ValidationError({"label": "A replacement name is required."})

        entrant.label = label
        entrant.players.set(request.data.get("player_ids", []))
        entrant.save(update_fields=["label", "updated_at"])
        _link_participants(entrant)

        return Response(EntrantSerializer(entrant, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="next-round")
    def next_round(self, request, pk=None):
        """
        Pair the next round.

        Only Swiss and FFA need this — every other format's graph is complete
        from generation.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can advance the round.")

        if tournament.format == Tournament.Format.SWISS:
            created = pair_next_round(tournament)
        elif tournament.format == Tournament.Format.FFA:
            created = next_ffa_round(tournament)
        else:
            raise ValidationError("This format generates every round up front.")

        if not created:
            raise ValidationError("There are no further rounds to play.")

        return Response(
            MatchSerializer(created, many=True, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="cohosts")
    def add_cohost(self, request, pk=None):
        """
        Let a trusted friend report results too (plan §4, NEW 12).

        Limited to the host's friends. A co-host can decide who won, which is
        the whole of the night's record — that is not a thing to hand to
        whichever account id happened to be posted.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can add co-hosts.")

        user_id = request.data.get("user")
        if not user_id:
            raise ValidationError({"user": "A user is required."})

        person = get_user_model().objects.filter(pk=user_id).first()
        if person is None:
            raise ValidationError({"user": "No such account."})

        if not are_friends(request.user, person):
            raise ValidationError(
                {"user": "You can only add your friends as co-hosts. Add them as a friend first."}
            )

        role, _ = Role.objects.get_or_create(
            tournament=tournament, user=person, defaults={"role": Role.Kind.COHOST}
        )

        return Response({"id": role.id, "role": role.role}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def favourite(self, request, pk=None):
        """
        Pin this tournament to the top of the list, or unpin it.

        Stamped with the time rather than flagged, so pinning a second one puts
        it below the first instead of competing with it for the top.
        """
        tournament = self.get_object()
        self.check_object_permissions(request, tournament)

        tournament.favourited_at = None if tournament.favourited_at else timezone.now()
        tournament.save(update_fields=["favourited_at", "updated_at"])

        return Response(TournamentSerializer(tournament, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def claim(self, request, pk=None):
        """
        Attach an anonymous quick-start bracket to the signed-in account.

        The secret token is the proof of ownership — whoever built it holds the
        URL, and nobody else can guess a 32-character hex string.
        """
        # Not self.get_object(): an unclaimed bracket has no owner, so it is
        # outside the user's queryset by definition. The claim token is what
        # proves the caller built it.
        tournament = Tournament.objects.filter(pk=pk).first()
        if tournament is None:
            raise ValidationError("No such tournament.")

        if not request.user.is_authenticated:
            raise PermissionDenied("Sign in to claim this tournament.")

        if not tournament.claim_token:
            raise ValidationError("This tournament has already been claimed.")

        if not secrets.compare_digest(tournament.claim_token, str(request.data.get("token", ""))):
            raise PermissionDenied("That claim link is not valid.")

        tournament.created_by = request.user
        tournament.claim_token = ""
        tournament.save(update_fields=["created_by", "claim_token", "updated_at"])

        Role.objects.get_or_create(
            tournament=tournament, user=request.user, defaults={"role": Role.Kind.HOST}
        )

        return Response(TournamentDetailSerializer(tournament, context={"request": request}).data)


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    """Reporting results. Reads follow the tournament's own visibility."""

    serializer_class = MatchSerializer
    permission_classes = [CanReportResults]

    def get_queryset(self):
        return Match.objects.select_related("a", "b", "winner", "tournament")

    @action(detail=True, methods=["post"])
    def report(self, request, pk=None):
        """
        Record a head-to-head result and advance both sides.

        Ratings are applied here rather than on a schedule so the leaderboard is
        correct the moment the score is entered.
        """
        match = self.get_object()
        self.check_object_permissions(request, match)

        serializer = ReportResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            report_result(
                match,
                score_a=serializer.validated_data["score_a"],
                score_b=serializer.validated_data["score_b"],
                reported_by=request.user if request.user.is_authenticated else None,
            )
        except ResultError as exc:
            raise ValidationError(str(exc)) from exc

        match.refresh_from_db()
        if match.winner_id:
            apply_match_result(match)

        _complete_if_finished(match.tournament)
        _sync_linked_stats(match.tournament)

        return Response(MatchSerializer(match, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="report-ffa")
    def report_ffa(self, request, pk=None):
        """Record a free-for-all lobby's finishing order."""
        match = self.get_object()
        self.check_object_permissions(request, match)

        serializer = ReportFFASerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        placements = {int(k): int(v) for k, v in serializer.validated_data["placements"].items()}

        try:
            report_ffa_result(
                match,
                placements,
                reported_by=request.user if request.user.is_authenticated else None,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        match.refresh_from_db()
        return Response(MatchSerializer(match, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def clear(self, request, pk=None):
        """Undo a result, including everything it advanced."""
        match = self.get_object()
        self.check_object_permissions(request, match)

        clear_result(match)
        match.refresh_from_db()
        _sync_linked_stats(match.tournament)

        return Response(MatchSerializer(match, context={"request": request}).data)


class SpectatorView(RetrieveAPIView):
    """
    The public bracket (plan §4, NEW 2).

    No account required: the organiser signs up, nine friends just click a link.
    That is the entire acquisition channel, so this must stay open.
    """

    serializer_class = SpectatorSerializer
    permission_classes = [AllowAny]
    lookup_field = "public_slug"
    queryset = Tournament.objects.prefetch_related("entrants", "matches")


@extend_schema(
    responses={200: dict},
    description="Standings for a public bracket, computed from its match rows.",
)
class SpectatorStandingsView(APIView):
    """Standings for a public bracket, same open access as the bracket itself."""

    permission_classes = [AllowAny]
    serializer_class = None

    def get(self, request, public_slug):
        tournament = Tournament.objects.filter(public_slug=public_slug).first()
        if tournament is None:
            raise ValidationError("No tournament with that link.")
        return Response(standings_payload(tournament))


class TeamGeneratorView(APIView):
    """
    Generate balanced teams (plan §3).

    Open to anonymous callers: the team generator is useful with a pasted list
    of names and no account, which is half the reason people arrive.
    """

    permission_classes = [AllowAny]
    serializer_class = None

    @extend_schema(request=dict, responses={200: dict})
    def post(self, request):
        names = request.data.get("names") or []
        player_ids = request.data.get("player_ids") or []
        team_count = int(request.data.get("team_count") or 2)
        balance = request.data.get("balance", "random")
        avoid = request.data.get("avoid") or None

        players, ratings = _resolve_players(request, names, player_ids, balance)

        if len(players) < 2:
            raise ValidationError("At least two players are needed.")

        constraints = _parse_constraints(request.data.get("constraints") or [], players)

        try:
            teams = generate_teams(
                players,
                team_count,
                constraints=constraints,
                balance=balance,
                ratings=ratings,
                avoid=avoid,
            )
        except TeamGenerationError as exc:
            raise ValidationError(str(exc)) from exc

        return Response(
            {
                "teams": [
                    [{"id": p.id, "name": getattr(p, "display_name", p.name)} for p in team]
                    for team in teams
                ],
                # Two teams is a series, not a bracket — a bracket for two is
                # just ceremony (plan §3).
                "suggest_series": len(teams) == 2,
            }
        )


# ── Helpers ───────────────────────────────────────────────────────────────────


class _AdHoc:
    """A name with no roster entry behind it, shaped like a Player."""

    def __init__(self, index, name):
        self.id = -(index + 1)  # negative, so it cannot collide with a real row
        self.display_name = name
        self.name = name


def _resolve_players(request, names, player_ids, balance):
    """Turn the request's names and roster ids into objects the generator takes."""
    players = []
    ratings = {}

    if player_ids and request.user.is_authenticated:
        roster = list(Player.objects.filter(owner=request.user, id__in=player_ids))
        players.extend(roster)

        if balance == "rating":
            from .models import Rating

            mode_id = request.data.get("mode")
            rating_rows = Rating.objects.filter(player__in=roster)
            if mode_id:
                rating_rows = rating_rows.filter(mode_id=mode_id)
            ratings = {r.player_id: r.elo for r in rating_rows}

    players.extend(_AdHoc(i, name.strip()) for i, name in enumerate(names) if name.strip())

    return players, ratings


def _parse_constraints(raw, players):
    """
    Build Constraint objects from the request payload.

    Rules may name their players (`player_names`) instead of carrying ids.
    Names are what the caller actually has for an ad-hoc list, and they survive
    the roster being edited: positional ids silently changed meaning whenever a
    name was removed or reordered, so a "keep apart" rule would either point at
    the wrong pair or at nobody at all — and a rule matching nobody passes
    vacuously, which is how two people who must not play together ended up on
    the same team.

    A rule that names someone no longer in the list is dropped rather than
    quietly weakened, so it cannot half-apply.
    """
    from .teams import Constraint

    # A name can be worn by more than one person — two Alexes in one group is
    # ordinary — so a name maps to every id holding it. A rule about "Alex"
    # then covers both, which is the only safe reading: applying it to whichever
    # Alex happened to be listed first left the other unconstrained, and the
    # pair landed together on roughly half the rolls.
    by_name: dict[str, list[int]] = {}
    for player in players:
        name = getattr(player, "display_name", None) or getattr(player, "name", "")
        by_name.setdefault(name.strip().casefold(), []).append(player.id)

    rules = []

    for item in raw:
        if not item.get("kind"):
            continue

        names = item.get("player_names")
        if names:
            resolved = [by_name.get(str(n).strip().casefold()) for n in names]
            # Every named player must still be present, or the rule is not the
            # rule the caller wrote.
            if any(ids is None for ids in resolved):
                continue
            player_ids = [pid for ids in resolved for pid in ids]
            # Keep the sides, so APART separates the named people from each
            # other rather than separating two namesakes.
            groups = resolved if item["kind"] == "apart" else None
        else:
            player_ids = item.get("player_ids") or []
            groups = None

        rules.append(
            Constraint(
                kind=item["kind"],
                player_ids=player_ids,
                team_index=item.get("team_index"),
                groups=groups,
            )
        )

    return rules


def acts_as_host(tournament, user) -> bool:
    """
    Whether `user` may take host actions on `tournament`.

    An unclaimed quick-start bracket has no owner, so whoever holds it is
    effectively its host — otherwise someone could build a bracket anonymously
    and then be unable to add an entrant to it.
    """
    return is_unclaimed(tournament) or _is_host(tournament, user)


def _create_entrants(tournament, labels, user=None):
    """
    Create entrants from a pasted list of names.

    In solo mode an entrant *is* a person, so each name is attached as a Player
    the same way a team's members are. Without that a linked stats board has
    nobody to track: it counts by player, and a bracket of bare labels has none
    — which showed up as a board that stayed empty all night.

    An anonymous host has no roster to attach to, so their entrants stay labels.
    That is the trade the no-account path makes.
    """
    created = []

    for index, label in enumerate(labels, start=1):
        label = str(label).strip()
        if not label:
            continue

        entrant = Entrant.objects.create(tournament=tournament, label=label, seed=index)
        created.append(entrant)

        if user is not None and user.is_authenticated:
            entrant.players.add(_player_named(user, label))
            _link_participants(entrant)

    return created


def _player_named(user, name):
    """This host's roster entry for `name`, created if they have none."""
    # Case-insensitive match, then create. get_or_create cannot be used with an
    # __iexact lookup: it would pass that through to the model constructor on
    # the create branch and raise.
    player = Player.objects.filter(owner=user, display_name__iexact=name).first()
    if player is None:
        player = Player.objects.create(owner=user, display_name=name)

    return player


def _create_team_entrants(tournament, teams, user):
    """
    Create entrants that are squads, attaching each member as a Player.

    Members are matched against the host's existing roster by name before a new
    Player is created, so sending the same crew to a second bracket links to the
    people already there rather than duplicating them — which would split one
    person's stats across two rows.

    For an anonymous host there is no roster to attach to, so the team is stored
    as a label alone and its members are lost. That is the trade the no-account
    path makes: nothing to own the Player rows.
    """
    created = []

    for index, team in enumerate(teams, start=1):
        entrant = Entrant.objects.create(
            tournament=tournament, label=str(team["label"]).strip(), seed=index
        )
        created.append(entrant)

        if not user.is_authenticated:
            continue

        for name in team.get("members") or []:
            name = str(name).strip()
            if not name:
                continue

            entrant.players.add(_player_named(user, name))

        _link_participants(entrant)

    return created


def _generate(tournament, seeding="random"):
    """Dispatch to the right generator for this tournament's format."""
    entrants = seed_entrants(list(tournament.entrants.all()), seeding)

    if len(entrants) < 2:
        raise ValidationError("A tournament needs at least two entrants.")

    fmt = tournament.format

    if fmt == Tournament.Format.SINGLE:
        generate_single_elimination(tournament, entrants, third_place=tournament.third_place_match)
    elif fmt == Tournament.Format.DOUBLE:
        generate_double_elimination(tournament, entrants, third_place=tournament.third_place_match)
    elif fmt == Tournament.Format.ROUND_ROBIN:
        generate_round_robin(
            tournament,
            entrants,
            double_round=bool((tournament.settings or {}).get("double_round")),
        )
    elif fmt == Tournament.Format.SWISS:
        generate_swiss(tournament, entrants)
    elif fmt == Tournament.Format.FFA:
        generate_ffa(tournament, entrants)

    # Re-seed in the order actually used, so the bracket and the entrant list
    # agree about who is seed 1.
    for index, entrant in enumerate(entrants, start=1):
        entrant.seed = index
    Entrant.objects.bulk_update(entrants, ["seed"])


def _link_participants(entrant):
    """
    Create Participation rows for entrants backed by a real account.

    This is what lets a player see events they have been added to and leave one
    (plan §8) — consent recorded from the start rather than retrofitted.
    """
    for player in entrant.players.all():
        if player.user_id:
            Participation.objects.get_or_create(entrant=entrant, user_id=player.user_id)


def _add_cohosts(tournament, user_ids, host):
    """
    Give a few friends reporting rights as the bracket is created.

    Doing it here rather than only afterwards is the difference between the host
    being the sole bottleneck for entering scores all night and not (plan §4,
    NEW 12) — by the time the first match ends, nobody wants to be in a settings
    screen.

    Anyone who is not the host's friend is skipped rather than failing the whole
    creation: losing a bracket because one name in a list was stale would be a
    poor trade.
    """
    if not user_ids or not host.is_authenticated:
        return

    people = get_user_model().objects.filter(pk__in=user_ids)

    for person in people:
        if person.id == host.id or not are_friends(host, person):
            continue

        Role.objects.get_or_create(
            tournament=tournament, user=person, defaults={"role": Role.Kind.COHOST}
        )


def _link_stats(tournament, board_slug, table_id, column_id, user):
    """
    Point this tournament at a stats board.

    Naming the board is enough: the columns a tournament fills are fixed, so the
    board itself knows where its results go. `stats_table` and `stats_column`
    remain for callers that want to name a specific one — an older client, or a
    board with several tables — but the host picking "League" from a list does
    not have to answer a second question about it.

    Gated on edit rights: linking writes onto someone else's board, so it needs
    the same permission tallying by hand does. A target the caller may not write
    to is refused outright rather than silently dropped — a host who thinks the
    night is being counted and finds out later that it was not is worse off than
    one told now.

    Players are enrolled immediately rather than at the final whistle. The board
    should show tonight's line-up while the night is still going, and a name that
    only appears on victory makes the table useless as a team sheet.
    """
    if not board_slug and not table_id and not column_id:
        return

    from apps.stats.awarding import (
        enrol_tournament_players,
        ensure_automatic_columns,
        sync_tournament_stats,
    )
    from apps.stats.models import BoardLink, StatsBoard, StatsColumn, StatsTable

    if board_slug:
        board = StatsBoard.objects.filter(slug=board_slug).select_related("owner").first()
        if board is None:
            raise ValidationError({"stats_board": "No such stats board."})

        table = _tournament_table_for(board)
        target = {"table": table}
    elif table_id:
        table = StatsTable.objects.filter(pk=table_id).select_related("board__owner").first()
        if table is None:
            raise ValidationError({"stats_table": "No such stats table."})
        target, board = {"table": table}, table.board
    else:
        column = (
            StatsColumn.objects.filter(pk=column_id).select_related("table__board__owner").first()
        )
        if column is None:
            raise ValidationError({"stats_column": "No such stats column."})
        target, board = {"column": column}, column.table.board

    if not board.may_edit(user):
        raise ValidationError(
            {"stats_board": "You do not have permission to add to that stats board."}
        )

    # A board picked by name may have been made for hand-counting. Rather than
    # refuse the link, give its table the columns a tournament needs — the host
    # asked for this night to count, and that is the thing that makes it count.
    if board_slug:
        ensure_automatic_columns(target["table"])

    link = BoardLink.objects.create(tournament=tournament, **target)

    enrol_tournament_players(link)
    sync_tournament_stats(link)


def _tournament_table_for(board):
    """
    The table on `board` that a tournament should feed.

    Prefers one already tracking tournaments; otherwise the first table, which
    is the only one on the overwhelming majority of boards. A board with no
    table at all gets one, since every board is created with one and this is
    only reachable if somebody deleted it.
    """
    from apps.stats.models import StatsColumn, StatsTable

    tables = list(board.tables.prefetch_related("columns"))

    for table in tables:
        if any(column.role != StatsColumn.Role.MANUAL for column in table.columns.all()):
            return table

    if tables:
        return tables[0]

    return StatsTable.objects.create(board=board, name="Tournaments", position=0)


def _complete_if_finished(tournament):
    """Mark a tournament complete once nothing further can be played."""
    unplayed = tournament.matches.filter(winner__isnull=True).exclude(
        models.Q(a__isnull=True) | models.Q(b__isnull=True)
    )

    if unplayed.exists() or tournament.state == Tournament.State.COMPLETE:
        return

    tournament.state = Tournament.State.COMPLETE
    tournament.completed_at = timezone.now()
    tournament.save(update_fields=["state", "completed_at", "updated_at"])

    _award_linked_stats(tournament)


def _award_linked_stats(tournament):
    """
    Credit the winners on a linked stats board, if there is one.

    Imported here rather than at module scope: tournaments know nothing about
    boards, and keeping it that way means the stats app can be removed without
    touching the bracket engine. Awarding is idempotent, so a corrected result
    that re-completes the tournament does not hand out a second set of marks.
    """
    from apps.stats.awarding import apply_tournament_result

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        apply_tournament_result(link)


def _sync_linked_stats(tournament):
    """
    Update a linked board's per-game numbers.

    Called after a result is reported *and* after one is cleared, because the
    counts are recomputed from the match rows rather than incremented — undoing
    a win has to walk the board back down as readily as reporting one walked it
    up.
    """
    from apps.stats.awarding import sync_tournament_stats

    link = getattr(tournament, "stats_link", None)
    if link is not None:
        sync_tournament_stats(link)
