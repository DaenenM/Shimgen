"""Local development settings — never use these to serve real traffic."""

from .base import *
from .base import INSTALLED_APPS, REST_FRAMEWORK, SECRET_KEY
from .env import env_bool, env_csv

DEBUG = True

# A fixed insecure key keeps sessions valid across restarts without asking every
# developer to generate one. prod.py refuses to start without a real key.
SECRET_KEY = SECRET_KEY or "django-insecure-local-development-only-key"

ALLOWED_HOSTS = env_csv("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,testserver")

# django-extensions gives shell_plus, show_urls and graph_models locally. It is
# deliberately absent from production, where the extra surface buys nothing.
INSTALLED_APPS = [*INSTALLED_APPS, "django_extensions"]

# The browsable API is the fastest way to poke at endpoints by hand while the
# React client is still being written.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}

# Throttling locally just gets in the way of a fast edit-refresh loop.
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {"anon": "10000/min", "user": "10000/min"}

# Vite's dev server moves ports when 5173 is taken, so allow the usual spread.
CORS_ALLOWED_ORIGINS = env_csv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:3000,http://127.0.0.1:3000",
)

# In-memory channel layer means WebSockets work locally with no Redis running.
# Set USE_REDIS=true to exercise the real fanout path before deploying.
if not env_bool("USE_REDIS", False):
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# Uncompressed static storage — the manifest backend errors on any file that
# collectstatic has not processed, which is every file during development.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
