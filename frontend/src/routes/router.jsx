/**
 * The route tree.
 *
 * Three tiers, and which tier a route sits in is a product decision, not a
 * technical one:
 *
 *  - public       — the landing page, auth screens, and crucially the quick
 *                   start and spectator views. Those two must work with no
 *                   account at all; they are the acquisition channel.
 *  - protected    — everything that needs a signed-in user, behind one guard.
 *  - catch-all    — 404.
 *
 * Pages are lazily loaded so the initial bundle carries the landing page and
 * the bracket builder, not the whole app.
 */

import { Navigate, createBrowserRouter } from 'react-router-dom'

import { RootLayout } from '@/components/layout/RootLayout'
import { PageLoader } from '@/components/ui/PageLoader'

import { ProtectedRoute } from './ProtectedRoute'
import { paths } from './paths'

/**
 * Pages load on demand, through the router's own `lazy`.
 *
 * Not `React.lazy` under a Suspense boundary, which is what this used to be:
 * the first visit to each page suspended the outlet, so the page you were on
 * was swapped for a full-screen spinner until the new chunk arrived — a flash
 * on every first navigation. The router's `lazy` resolves the chunk *before*
 * it commits the navigation, so the current page stays up (with the progress
 * bar in RootLayout running) and the new one replaces it whole.
 *
 * The pages are named exports, mapped onto `Component` here, so a typo at the
 * import site is a build error rather than an undefined component at runtime.
 */
const loaders = []

function page(load, name) {
  loaders.push(load)
  return async () => ({ Component: (await load())[name] })
}

const pages = {
  Home: page(() => import('@/pages/HomePage'), 'HomePage'),
  QuickStart: page(() => import('@/pages/QuickStartPage'), 'QuickStartPage'),
  Login: page(() => import('@/pages/LoginPage'), 'LoginPage'),
  Register: page(() => import('@/pages/RegisterPage'), 'RegisterPage'),
  Spectator: page(() => import('@/pages/SpectatorPage'), 'SpectatorPage'),
  Dashboard: page(() => import('@/pages/DashboardPage'), 'DashboardPage'),
  Tournaments: page(() => import('@/pages/TournamentsPage'), 'TournamentsPage'),
  TournamentDetail: page(() => import('@/pages/TournamentDetailPage'), 'TournamentDetailPage'),
  DraftLobby: page(() => import('@/pages/DraftLobbyPage'), 'DraftLobbyPage'),
  TeamGenerator: page(() => import('@/pages/TeamGeneratorPage'), 'TeamGeneratorPage'),
  Stats: page(() => import('@/pages/StatsPage'), 'StatsPage'),
  Board: page(() => import('@/pages/BoardPage'), 'BoardPage'),
  Roster: page(() => import('@/pages/RosterPage'), 'RosterPage'),
  SavedTeams: page(() => import('@/pages/SavedTeamsPage'), 'SavedTeamsPage'),
  Friends: page(() => import('@/pages/FriendsPage'), 'FriendsPage'),
  Profile: page(() => import('@/pages/ProfilePage'), 'ProfilePage'),
  NotFound: page(() => import('@/pages/NotFoundPage'), 'NotFoundPage'),
}

/**
 * Fetch every page's chunk in the background, once the browser is idle.
 *
 * Splitting keeps the first load small; this is what stops the split costing a
 * round trip on each later navigation. Idle time only, so it never competes
 * with the page actually being shown. The chunks total a few hundred KB and
 * the browser caches them, so a returning visitor pays nothing. A failure here
 * is ignored: the page simply loads on demand instead, as before.
 */
export function preloadPages() {
  const run = () => loaders.forEach((load) => load().catch(() => {}))

  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

/**
 * Turn a link's readable tail back into something a tab can show.
 *
 * "friday-night-cafe" becomes "Friday night cafe". It is the name the user
 * typed, slugified, so it is close enough to name the tab immediately rather
 * than leaving a generic title until the fetch lands.
 */
function titleFromSlug(slug) {
  if (!slug) return null

  const words = slug.replace(/-/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    // Shown on the very first load only, while the first page's chunk
    // arrives; every navigation after that keeps the current page up.
    hydrateFallbackElement: <PageLoader />,
    children: [
      // ── Public ────────────────────────────────────────────────────────────
      {
        index: true,
        lazy: pages.Home,
        // No title: the home tab reads just "Shimgen".
        handle: {
          description:
            'Free tournament bracket generator and random team generator. Single and double elimination, round robin and Swiss, plus stats boards that track wins across game nights. No sign-up needed.',
        },
      },
      {
        path: paths.quickStart,
        lazy: pages.QuickStart,
        handle: {
          title: 'New Tournament',
          description:
            'Make a tournament bracket in seconds. Single elimination, double elimination, round robin, Swiss and free-for-all, with best-of series and automatic seeding. Free, no account required.',
        },
      },
      // The form's old address. Links to it are already out in group chats and
      // bookmarks, so it forwards rather than 404s.
      { path: '/new', element: <Navigate to={paths.quickStart} replace /> },
      { path: paths.login, lazy: pages.Login, handle: { title: 'Log in' } },
      { path: paths.register, lazy: pages.Register, handle: { title: 'Sign up' } },
      // Deliberately outside ProtectedRoute: nine friends click this link and
      // none of them have an account.
      // The trailing name is decorative: the slug in front resolves the page,
      // so a renamed or mistyped tail still lands. `?` keeps the bare form
      // working, which is what every link shared before this looked like.
      {
        path: `${paths.spectate(':publicSlug')}/:name?`,
        lazy: pages.Spectator,
        handle: { title: 'Spectate' },
      },
      // These three are nav destinations that must work signed out — each has a
      // useful anonymous mode, and gating them would put the signup wall back
      // in front of the product (plan §4, NEW 6).
      {
        path: paths.tournaments,
        lazy: pages.Tournaments,
        handle: {
          title: 'Tournaments',
          description:
            'Every bracket you host, help run or play in, with its format, entrants and winner.',
        },
      },
      // Before the bracket route, which would otherwise match /:id/draft with
      // "draft" as the decorative name segment and render an empty bracket.
      // Public for the same reason the bracket is: a drafted quick-start
      // tournament has no account behind it, and gating the lobby would strand
      // the host on the page they just created.
      {
        path: `${paths.draft(':id')}/:name?`,
        lazy: pages.DraftLobby,
        handle: { title: 'Team draft' },
      },
      {
        path: `${paths.tournament(':id')}/:name?`,
        lazy: pages.TournamentDetail,
        // The readable tail of the URL is the tournament's own name, so the tab
        // can say which bracket this is without waiting for the fetch.
        handle: { title: (match) => titleFromSlug(match.params.name) ?? 'Tournament' },
      },
      {
        path: paths.teamGenerator,
        lazy: pages.TeamGenerator,
        handle: {
          title: 'Team Generator',
          description:
            'Paste a list of names and split them into balanced random teams. Keep two players apart, keep a pair together, and re-roll until the split looks right. Free team randomizer, no sign-up.',
        },
      },
      {
        path: paths.stats,
        lazy: pages.Stats,
        handle: {
          title: 'Stats',
          description:
            'Build a stats board for your group. Track wins, losses and games played by player, tally by hand or let linked tournaments fill it in automatically.',
        },
      },
      // A board is shared by link, so reading one must work signed out.
      {
        path: `${paths.board(':slug')}/:name?`,
        lazy: pages.Board,
        handle: { title: (match) => titleFromSlug(match.params.name) ?? 'Stats' },
      },

      // ── Signed in ─────────────────────────────────────────────────────────
      {
        element: <ProtectedRoute />,
        children: [
          { path: paths.dashboard, lazy: pages.Dashboard, handle: { title: 'Dashboard' } },
          { path: paths.roster, lazy: pages.Roster, handle: { title: 'My Roster' } },
          {
            path: paths.savedTeams,
            lazy: pages.SavedTeams,
            handle: { title: 'Saved Teams' },
          },
          { path: paths.friends, lazy: pages.Friends, handle: { title: 'Friends' } },
          { path: paths.profile, lazy: pages.Profile, handle: { title: 'Profile' } },
        ],
      },

      { path: '*', lazy: pages.NotFound, handle: { title: 'Not found' } },
    ],
  },
])
