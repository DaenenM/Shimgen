"""Public, read-only spectator views."""

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Tournament
from ..serializers import (
    SpectatorSerializer,
)
from ..services.standings import standings_payload


class SpectatorView(RetrieveAPIView):
    """
    The public bracket (plan §4, NEW 2).

    No account required: the organiser signs up, nine friends just click a link.
    That is the entire acquisition channel, so this must stay open.
    """

    serializer_class = SpectatorSerializer
    permission_classes = [AllowAny]
    lookup_field = "public_slug"
    # Same nested prefetches as the host view: a spectator renders the same
    # bracket, and this is the page strangers land on from a shared link.
    queryset = Tournament.objects.select_related("mode", "created_by").prefetch_related(
        "entrants",
        "entrants__players",
        "roles",
        "roles__user",
        "matches__a",
        "matches__b",
        "matches__winner",
        "matches__reported_by",
    )


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
