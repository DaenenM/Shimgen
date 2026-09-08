"""Auth, profile and friend endpoints."""

from django.conf import settings
from django.db import models
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .google import GoogleAuthError, get_or_create_user, verify_token
from .models import Friendship, User
from .serializers import (
    FriendRequestSerializer,
    FriendshipSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    """
    Create an account.

    Open to anonymous callers, obviously, and throttled by the anon rate so it
    cannot be used to enumerate or spam addresses.
    """

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Return the profile shape the client expects from /auth/me/, so the
        # frontend can reuse one parser for both.
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class GoogleAuthView(APIView):
    """
    Exchange a Google ID token for this application's own JWT pair.

    The client never receives a Google token beyond this call: it is verified,
    traded for our tokens, and discarded. That keeps one auth system in the app
    — everything downstream sees an ordinary Shimgen access token, whether the
    user signed in with a password or with Google.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = None

    @extend_schema(request=dict, responses={200: dict})
    def post(self, request):
        try:
            claims = verify_token(request.data.get("credential", ""))
            user, created = get_or_create_user(claims)
        except GoogleAuthError as exc:
            return Response(
                {"error": {"code": "google_auth_failed", "message": str(exc), "details": {}}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {
                    "error": {
                        "code": "account_disabled",
                        "message": "This account has been disabled.",
                        "details": {},
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
                # Lets the client route a brand-new user differently — straight
                # into onboarding rather than back to a dashboard with nothing
                # in it yet.
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AuthConfigView(APIView):
    """
    What sign-in methods this deployment actually supports.

    The frontend asks before rendering, so a server with no Google client ID
    configured simply does not show the button — rather than showing one that
    fails the moment it is clicked.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = None

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(
            {
                "google": {
                    "enabled": bool(settings.GOOGLE_CLIENT_ID),
                    # Public by design: it ships in the frontend bundle anyway,
                    # and serving it here keeps the client from needing its own
                    # copy of the same value.
                    "client_id": settings.GOOGLE_CLIENT_ID,
                }
            }
        )


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user's own profile."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UserSearchView(generics.ListAPIView):
    """
    Find people to add as friends.

    Requires a search term rather than listing every account: without it this
    endpoint is a user directory, which is not something to hand out.
    """

    serializer_class = PublicUserSerializer

    def get_queryset(self):
        term = self.request.query_params.get("q", "").strip()
        if len(term) < 2:
            return User.objects.none()

        return User.objects.filter(
            models.Q(username__icontains=term) | models.Q(display_name__icontains=term)
        ).exclude(pk=self.request.user.pk)[:20]


class FriendshipViewSet(viewsets.ModelViewSet):
    """
    Friend requests and accepted links.

    Friends exist for cross-group stat continuity (plan §3): adding a friend to
    an event links the entrant to their real account, so their results
    accumulate to their profile even when someone else is hosting.
    """

    serializer_class = FriendshipSerializer
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        # Schema generation walks viewsets with an anonymous request; without
        # this guard `involving(AnonymousUser)` raises on the FK comparison.
        if not self.request.user.is_authenticated:
            return Friendship.objects.none()

        return (
            Friendship.objects.involving(self.request.user)
            .select_related("from_user", "to_user")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return FriendRequestSerializer
        return FriendshipSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        friendship = serializer.save()

        return Response(
            FriendshipSerializer(friendship, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """
        Accept a request.

        Only the recipient may accept — otherwise the sender could befriend
        themselves into someone else's account.
        """
        friendship = self.get_object()

        if friendship.to_user_id != request.user.id:
            return Response(
                {"detail": "Only the recipient can accept this request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        friendship.status = Friendship.Status.ACCEPTED
        friendship.save(update_fields=["status", "updated_at"])

        return Response(self.get_serializer(friendship).data)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Incoming requests awaiting this user's decision."""
        queryset = self.get_queryset().filter(
            to_user=request.user, status=Friendship.Status.PENDING
        )
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=["get"])
    def sent(self, request):
        """
        Requests this user has sent and nobody has answered yet.

        Without this a sender has no evidence their request went anywhere: the
        page looked identical before and after, so the natural response was to
        send it again.
        """
        queryset = self.get_queryset().filter(
            from_user=request.user, status=Friendship.Status.PENDING
        )
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=["get"])
    def accepted(self, request):
        """This user's actual friends."""
        queryset = self.get_queryset().accepted()
        return Response(self.get_serializer(queryset, many=True).data)
