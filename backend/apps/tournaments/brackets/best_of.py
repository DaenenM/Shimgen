"""
Per-round best-of defaults.

`best_of` is a property of a Match, not of the Tournament (plan §3), because
real events run Bo1 early, Bo3 in semis and Bo5 in the final. Generation seeds
each match from the tournament's settings; the host can override any single
match afterwards.

Settings shape:

    {"best_of": {"default": 1, "quarterfinal": 3, "semifinal": 3, "final": 5}}
"""

VALID = (1, 3, 5, 7)

# Rounds counted back from the last: the final is 0 rounds from the end, the
# semifinal 1, and so on. Named this way so a setting means the same thing
# whether the bracket has 4 entrants or 64.
_FROM_END = {0: "final", 1: "semifinal", 2: "quarterfinal"}


def best_of_for(settings: dict, round_no: int, total_rounds: int) -> int:
    """
    Resolve the best_of for one round.

    Falls back to the configured default, then to Bo1. An invalid value is
    ignored rather than raising: a malformed setting should not stop a bracket
    from generating, and Bo1 is the safe reading.
    """
    config = (settings or {}).get("best_of") or {}

    rounds_from_end = total_rounds - round_no
    name = _FROM_END.get(rounds_from_end)

    for key in (name, "default"):
        if key and key in config:
            value = config[key]
            if value in VALID:
                return value

    return 1


def resolve_best_of(value, fallback: int = 1) -> int:
    """Coerce a host-supplied best_of to a legal value."""
    return value if value in VALID else fallback
