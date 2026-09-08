"""
Shared settings for shim.gg.

Environment-specific overrides live in dev.py and prod.py. Anything that differs
between local and production belongs in one of those two files, not here.
"""

from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

from .env import env_bool, env_csv, env_int, env_str

# BASE_DIR is backend/ — three levels up from config/settings/base.py.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Read backend/.env into os.environ before any env_* call below looks at it.
load_dotenv(BASE_DIR / ".env")

# ── Core ──────────────────────────────────────────────────────────────────────
# SECRET_KEY has no default on purpose. dev.py supplies an insecure fallback so
# local work is frictionless; prod.py leaves it required, so a misconfigured
# deploy fails loudly instead of signing tokens with a published key.
SECRET_KEY = env_str("SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS = env_csv("ALLOWED_HOSTS", "localhost,127.0.0.1")

AUTH_USER_MODEL = "accounts.User"
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Public URL of the frontend. Spectator links and transactional email are built
# from this, so it points at the React app rather than the API.
SITE_URL = env_str("SITE_URL", "http://localhost:5173").rstrip("/")

# ── Applications ──────────────────────────────────────────────────────────────
DJANGO_APPS = [
    "daphne",  # must precede staticfiles so runserver becomes the ASGI server
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "channels",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.groups",
    "apps.stats",
    "apps.tournaments",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # first: must run before CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Database ──────────────────────────────────────────────────────────────────
# One DATABASE_URL drives every environment (postgres://user:pass@host/name).
# conn_max_age keeps connections alive between requests; conn_health_checks
# re-validates a pooled connection before reuse, so a restarted Postgres does
# not surface as a burst of InterfaceErrors.
DATABASES = {
    "default": dj_database_url.config(
        default=env_str("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/shim"),
        conn_max_age=env_int("DB_CONN_MAX_AGE", 600),
        conn_health_checks=True,
    )
}

# ── Password validation ───────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ── Static & media ────────────────────────────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        # Session auth stays enabled so the browsable API and Django admin work
        # against the same endpoints during development.
        "rest_framework.authentication.SessionAuthentication",
    ),
    # Locked down by default. Public reads — spectator links, no-account quick
    # start — opt out explicitly with AllowAny on the view.
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "config.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {"anon": "120/min", "user": "600/min"},
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env_int("JWT_ACCESS_MINUTES", 30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env_int("JWT_REFRESH_DAYS", 14)),
    # Rotation plus blacklisting means a stolen refresh token is usable once at
    # most: the first use invalidates it, so the thief and the real user cannot
    # both stay signed in.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "shim.gg API",
    "DESCRIPTION": "Brackets, team generation and persistent stats for recurring game nights.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
}

# ── Google sign-in ────────────────────────────────────────────────────────────
# The OAuth client ID from Google Cloud Console. It is not a secret — it ships
# in the frontend bundle — but it is the audience every ID token is checked
# against, so a wrong value here means every Google login is rejected.
#
# Left empty by default: the frontend hides the Google button when it has no
# client ID, so an unconfigured deploy simply offers email sign-in instead of
# showing a button that cannot work.
GOOGLE_CLIENT_ID = env_str("GOOGLE_CLIENT_ID", "")

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env_csv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
CSRF_TRUSTED_ORIGINS = env_csv(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
# The SPA authenticates with a Bearer token rather than cookies, so credentialed
# CORS stays off — nothing needs it, and leaving it on widens the blast radius
# of any future mistake in the origin list.
CORS_ALLOW_CREDENTIALS = False

# ── Channels ──────────────────────────────────────────────────────────────────
# Redis fans WebSocket messages out across processes. dev.py swaps in the
# in-memory layer so local work needs no Redis running.
REDIS_URL = env_str("REDIS_URL", "redis://127.0.0.1:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ── Email ─────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = env_str("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env_str("EMAIL_HOST", "")
EMAIL_PORT = env_int("EMAIL_PORT", 587)
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = env_str("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env_str("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = env_str("DEFAULT_FROM_EMAIL", "noreply@shim.gg")

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
    "loggers": {
        # Query logging is deafening at DEBUG and rarely what you want by default.
        "django.db.backends": {
            "level": "WARNING",
            "handlers": ["console"],
            "propagate": False,
        },
    },
}
