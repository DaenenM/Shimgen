"""Granting and revoking co-host access.

Mixed into TournamentViewSet (views/tournament.py).
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import are_friends

from ..models import Role
from ..permissions import acts_as_host


class CohostActionsMixin:
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

    @action(
        detail=True,
        methods=["delete"],
        url_path="cohosts/(?P<user_id>[^/.]+)",
    )
    def remove_cohost(self, request, pk=None, user_id=None):
        """
        Take a co-host's permission back.

        Only co-hosts: the host's own role is what makes them the host, and
        deleting it would leave the tournament with nobody able to run it.
        """
        tournament = self.get_object()

        if not acts_as_host(tournament, request.user):
            raise PermissionDenied("Only the host can remove co-hosts.")

        role = Role.objects.filter(
            tournament=tournament, user_id=user_id, role=Role.Kind.COHOST
        ).first()

        if role is None:
            raise ValidationError({"user": "They are not a co-host of this tournament."})

        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
