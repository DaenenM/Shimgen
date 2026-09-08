# shim.gg

Brackets, team generation and persistent stats for recurring game nights.

Every piece of this exists somewhere already — Challonge does brackets, Keamk
does team randomising, RivalBoard does group stats. Nobody joins them. The wedge
is the loop: **roster → balanced teams → bracket → results that persist and
accumulate**, for the same ten friends playing every Saturday.

The full product thinking is in [`game-night-tools-plan.md`](game-night-tools-plan.md).
Code comments reference its sections (plan §3, plan §4 NEW 1, …) rather than
restating the reasoning.

---

## Stack

| Layer     | Choice                                                          |
| --------- | --------------------------------------------------------------- |
| Backend   | Django 6 + Django REST Framework, ASGI via Daphne                |
| Database  | PostgreSQL 16                                                     |
| Auth      | JWT (SimpleJWT) with refresh rotation and blacklisting            |
| Realtime  | Django Channels + Redis (wired, dormant until the first consumer) |
| Frontend  | React 19 + Vite 8, React Router 7                                 |
| Styling   | Tailwind CSS 4 + DaisyUI 5                                        |
| Data      | TanStack Query 5 + axios                                          |
| Icons     | lucide-react                                                      |

---

## Layout

```
TTS/
├── backend/
│   ├── config/              # project config, not an app
│   │   ├── settings/        # base.py + dev.py + prod.py
│   │   ├── urls.py          # everything under /api/v1/
│   │   ├── exceptions.py    # the single API error envelope
│   │   ├── pagination.py
│   │   ├── routing.py       # WebSocket routes
│   │   └── ws_auth.py       # JWT auth for WebSockets
│   └── apps/
│       ├── common/          # abstract models, slug helpers
│       ├── accounts/        # User, Friendship
│       ├── groups/          # Group, Player roster, Game/GameMode, Season
│       └── tournaments/     # Tournament, Entrant, Match, Rating
└── frontend/
    └── src/
        ├── api/             # axios client, token storage
        ├── components/      # layout/ and ui/ — shared, presentational
        ├── config/          # environment access
        ├── context/         # AuthContext + AuthProvider
        ├── features/        # feature modules (bracket, teams, roster…)
        ├── hooks/
        ├── lib/             # queryClient and query keys
        ├── pages/           # one component per route
        └── routes/          # router, paths, guards
```

`components/` holds anything shared and presentational; `features/` is where a
self-contained slice of the product lives (the bracket renderer, the team
generator) once it grows past a single file.

---

## Getting started

Requires **Python 3.12+**, **Node 22+**, and a running **PostgreSQL**.

### Backend

```bash
cd backend
python -m venv venv
venv/Scripts/activate          # Windows;  source venv/bin/activate elsewhere

pip install -r requirements-dev.txt

cp .env.example .env           # then set SECRET_KEY and DATABASE_URL
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"

python manage.py migrate
python manage.py createsuperuser    # email + password; username is derived
python manage.py runserver
```

The API is on <http://127.0.0.1:8000>. Interactive docs at `/api/docs/`,
the admin at `/admin/`, and a database-touching health probe at `/healthz`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

<http://localhost:5173>. Vite proxies `/api` and `/ws` to Django, so the app
makes same-origin requests in development and CORS never enters the picture.

---

## Google sign-in (optional)

"Continue with Google" appears on the login and register pages only when a
client ID is configured. Without one the button hides itself and the forms fall
back to email and password, so this is safe to skip until you want it.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   go to **APIs & Services > Credentials > Create credentials > OAuth client ID**
   and choose **Web application**.
2. Under **Authorised JavaScript origins**, add the frontend origin exactly:
   - `http://localhost:5173` for development
   - `https://shim.gg` for production
   No redirect URI is needed — Google Identity Services hands the token back to
   the page rather than redirecting.
3. Put the client ID in `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
4. Restart the backend. `/api/v1/auth/config/` should now report
   `"enabled": true`, and the button appears.

The client ID is public and ships in the frontend bundle. The client **secret**
is not used by this flow — do not add it to the environment.

**How it works:** the browser gets an ID token from Google, posts it to
`/api/v1/auth/google/`, and Django verifies the signature, issuer, expiry and
audience before issuing its own JWT pair. Everything downstream sees an ordinary
shim.gg token, so there is one auth system rather than two. Accounts are matched
on Google's stable `sub` first, then on a verified email — which links Google to
an account that already signed up with that address instead of creating a
duplicate.

---

## Commands

**Backend** (from `backend/`, venv active)

| Command                          | What it does                            |
| -------------------------------- | --------------------------------------- |
| `python manage.py runserver`     | Dev server (Daphne, so WebSockets work) |
| `python manage.py makemigrations`| Generate migrations                     |
| `python manage.py migrate`       | Apply them                              |
| `python manage.py shell_plus`    | Shell with all models imported          |
| `pytest`                         | Test suite                              |
| `pytest --cov`                   | With coverage                           |
| `ruff check . --fix`             | Lint                                    |
| `ruff format .`                  | Format                                  |

**Frontend** (from `frontend/`)

| Command            | What it does                    |
| ------------------ | ------------------------------- |
| `npm run dev`      | Dev server with HMR             |
| `npm run build`    | Production build to `dist/`     |
| `npm run preview`  | Serve that build locally        |
| `npm run lint`     | ESLint                          |
| `npm run format`   | Prettier                        |
| `npm run test`     | Vitest                          |

---

## Conventions

**One error shape.** Every API error returns
`{"error": {"code", "message", "details"}}`, applied centrally in
`config/exceptions.py` and unwrapped into an `ApiError` in `api/client.js`. The
frontend reads `.message` for a toast and `.details` for field errors, always.

**Settings are split, not conditional.** `dev.py` and `prod.py` layer over
`base.py`. Production fails at startup on a missing `SECRET_KEY` or a default
`ALLOWED_HOSTS` rather than degrading quietly.

**Query keys come from a factory.** `lib/queryClient.js` exports `queryKeys`;
building keys inline is how a cache invalidation silently misses.

**Paths come from a factory too.** `routes/paths.js`. A renamed route is one
edit, and a typo is a missing export rather than a 404 in production.

**Standings are computed, never stored.** They derive from `Match` rows, so
there are no denormalised counters to drift out of sync.

---

## Testing priority

From plan §8: **double elimination and Swiss are bug farms.** A wrong bracket
destroys trust instantly and permanently. When those generators are written,
test them across 3–64 entrants, byes, and odd counts before anything else gets
polish.

---

## Build order

Per plan §7 — v1 is a weekend and ships before v2 starts:

1. **v1** — Single elimination. Paste names → bracket → click winners → save →
   spectator link. Per-entrant nicknames. Saved roster in `localStorage`.
   No accounts.
2. **v2** — Accounts, groups, server-side rosters. Round robin. Best-of series.
3. **v3** — Team generator with constraints. Stat tracking. Friends.
4. **v4** — Double elimination + bracket reset. Ratings feeding team balance.
   Late joins, substitutions, co-hosts.
5. **v5** — Swiss, FFA, seasons, live updates.
6. **v6** — Discord bot.
