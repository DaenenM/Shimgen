"""Serializers for accounts and the friend graph."""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Friendship, User


class UserSerializer(serializers.ModelSerializer):
    """The signed-in user's own profile."""

    name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "display_name", "name", "avatar", "date_joined")
        read_only_fields = ("id", "email", "date_joined")


class PublicUserSerializer(serializers.ModelSerializer):
    """
    Another user, as seen by anyone else.

    Deliberately narrow: no email, no join date. A friend search should not be a
    way to harvest addresses.
    """

    name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "name", "avatar")


class RegisterSerializer(serializers.ModelSerializer):
    """Account creation."""

    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ("id", "email", "username", "display_name", "password")
        extra_kwargs = {
            # The manager derives a username from the email when none is given,
            # so signup can ask for as little as an email and a password.
            "username": {"required": False},
        }

    def validate_email(self, value):
        # Normalised so Example@x.com and example@x.com cannot both register.
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        # Runs the AUTH_PASSWORD_VALIDATORS chain, so the rules live in settings
        # rather than being duplicated here.
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class FriendshipSerializer(serializers.ModelSerializer):
    """A friend request or an accepted link, from the reader's point of view."""

    from_user = PublicUserSerializer(read_only=True)
    to_user = PublicUserSerializer(read_only=True)
    # Whether the reader sent this request or received it — the client needs it
    # to decide between showing "Accept" and "Cancel".
    direction = serializers.SerializerMethodField()

    class Meta:
        model = Friendship
        fields = ("id", "from_user", "to_user", "status", "direction", "created_at")
        read_only_fields = ("id", "status", "created_at")

    def get_direction(self, obj) -> str:
        user = self.context["request"].user
        return "outgoing" if obj.from_user_id == user.id else "incoming"


class FriendRequestSerializer(serializers.Serializer):
    """Sending a request, addressed by username or email."""

    identifier = serializers.CharField(help_text="The username or email of the person to add.")

    def validate_identifier(self, value):
        value = value.strip()
        request_user = self.context["request"].user

        target = (
            User.objects.filter(username__iexact=value).first()
            or User.objects.filter(email__iexact=value).first()
        )

        if target is None:
            raise serializers.ValidationError("No account found with that name or email.")
        if target.id == request_user.id:
            raise serializers.ValidationError("You cannot add yourself.")

        # Either direction counts — if they already asked you, accept that
        # request rather than creating a mirrored second one.
        existing = (
            Friendship.objects.involving(request_user)
            .filter(from_user__in=[request_user, target], to_user__in=[request_user, target])
            .first()
        )

        if existing is not None:
            if existing.status == Friendship.Status.ACCEPTED:
                raise serializers.ValidationError("You are already friends.")
            if existing.status == Friendship.Status.BLOCKED:
                raise serializers.ValidationError("This request cannot be sent.")
            raise serializers.ValidationError("A request is already pending.")

        self.target = target
        return value

    def create(self, validated_data):
        return Friendship.objects.create(
            from_user=self.context["request"].user, to_user=self.target
        )
