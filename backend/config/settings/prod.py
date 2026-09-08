"""Production settings. Fails fast on anything missing rather than degrading quietly."""

from .base import *
from .base import ALLOWED_HOSTS, REST_FRAMEWORK, SECRET_KEY
from .env import env_bool, env_int

DEBUG = False

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is required when DEBUG is False.")

if not ALLOWED_HOSTS or ALLOWED_HOSTS == ["localhost", "127.0.0.1"]:
    raise RuntimeError("ALLOWED_HOSTS must name the production domains.")

# ── HTTPS and cookies ─────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)  # one year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

# Managed hosts (Render, Fly, Heroku) terminate TLS at their proxy, so Django
# needs this header to know the original request was https. Without it,
# SECURE_SSL_REDIRECT sees http:// on every request and redirects forever.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# ── API surface ───────────────────────────────────────────────────────────────
# JSON only. The browsable API renders user-supplied content as HTML and is a
# development convenience with no place in production.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
}
