"""Authentication, profile and friend routes."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from .views import (
    AuthConfigView,
    FriendshipViewSet,
    GoogleAuthView,
    MeView,
    RegisterView,
    UserSearchView,
)

app_name = "accounts"

router = DefaultRouter()
router.register("friends", FriendshipViewSet, basename="friend")

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    # Logout blacklists the refresh token so it cannot be rotated again.
    path("logout/", TokenBlacklistView.as_view(), name="token-blacklist"),
    path("register/", RegisterView.as_view(), name="register"),
    # Social sign-in: verify a Google ID token, return our own JWT pair.
    path("google/", GoogleAuthView.as_view(), name="google"),
    path("config/", AuthConfigView.as_view(), name="config"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserSearchView.as_view(), name="user-search"),
    path("", include(router.urls)),
]
