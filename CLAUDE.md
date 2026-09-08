# Shimgen — working notes

Product spec: `game-night-tools-plan.md`. Setup and commands: `README.md`.

## Orientation

Django 6 + DRF backend (`backend/`), React 19 + Vite frontend (`frontend/`),
PostgreSQL, JWT auth, Channels wired for later live updates.

The core insight the data model is built around: **`Player` and `Entrant` are
separate on purpose.** `Player` is a durable person in someone's roster —
ratings and stats hang off it. `Entrant` is that person in one tournament,
carrying the per-event nickname. Collapsing them breaks the ability to be "Pig
Benis" on Saturday and "Shim" on Sunday while keeping one stat line. Do not
merge them.

The second load-bearing decision: **the match graph is generated up front**,
with `Match.next_match_win` / `next_match_lose` edges. Reporting a result pushes
entrants along those edges, so one advancement routine serves every format.
Double elimination is data, not a special case. Resist adding format-specific
advancement code.

## Rules that are easy to get wrong

- **Standings are computed from `Match`, never stored.** No denormalised
  counters — they drift.
- **Late joins on elimination brackets are structurally impossible.** Gate on
  `Tournament.state` and say so plainly in the UI. A silent regenerate that
  wipes results is far worse than a clear refusal (plan §8).
- **Spectator and quick-start routes must work signed out.** They are the entire
  acquisition channel. Anything added under `ProtectedRoute` that these need is
  a bug.
- **`best_of` lives on `Match`, not `Tournament`.** Bo1 early, Bo3 semis, Bo5
  final is the standard pattern.

## Where things go

| Adding…                        | Goes in                                      |
| ------------------------------ | -------------------------------------------- |
| A model                        | `backend/apps/<app>/models.py`               |
| An endpoint                    | `views.py` + register in that app's `urls.py`|
| A shared abstract model        | `backend/apps/common/models.py`              |
| A route                        | `frontend/src/routes/paths.js` + `router.jsx`|
| A page                         | `frontend/src/pages/`                        |
| A self-contained product slice | `frontend/src/features/<name>/`              |
| Something shared + presentational | `frontend/src/components/ui/`             |

## Conventions

- API errors: one envelope, `{"error": {code, message, details}}`. Never return
  a bare `{"detail": ...}` — `config/exceptions.py` normalises it, so raise DRF
  exceptions and let it do the work.
- Query keys come from `queryKeys` in `lib/queryClient.js`. Never inline.
- Route paths come from `paths` in `routes/paths.js`. Never inline.
- Run `ruff check . --fix && ruff format .` before finishing backend work,
  `npm run lint && npm run format` before finishing frontend work.
- Comments explain *why*, not *what*. Reference plan sections (plan §4, NEW 1)
  rather than restating the reasoning.

## Testing

`pytest` (backend), `npm run test` (frontend).

When the bracket generators land, they need real coverage across 3–64 entrants,
byes and odd counts — plan §8 flags double elimination and Swiss as the places
where a bug destroys trust instantly. That is the one area where thorough tests
are non-negotiable.
