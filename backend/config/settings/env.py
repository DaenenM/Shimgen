"""
Small typed readers over os.environ.

Everything in a .env file is a string, so every settings module ends up writing
the same `== "True"` and `int(...)` conversions by hand. These four helpers keep
that coercion in one place and make a malformed value fail at startup with a
message naming the variable, rather than surfacing later as a confusing type
error deep inside Django.
"""

import os

TRUTHY = {"1", "true", "yes", "on"}
FALSY = {"0", "false", "no", "off", ""}


def env_str(key: str, default: str = "") -> str:
    """Read a string, falling back to `default` when unset."""
    return os.environ.get(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    """Read a boolean written as true/false, 1/0, yes/no or on/off."""
    raw = os.environ.get(key)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in TRUTHY:
        return True
    if value in FALSY:
        return False
    raise ValueError(f"{key}={raw!r} is not a valid boolean")


def env_int(key: str, default: int = 0) -> int:
    """Read an integer, rejecting values that are not parseable as one."""
    raw = os.environ.get(key)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{key}={raw!r} is not a valid integer") from exc


def env_csv(key: str, default: str = "") -> list[str]:
    """Read a comma-separated list, dropping empty entries and stray whitespace."""
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]
