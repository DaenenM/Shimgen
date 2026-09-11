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

import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { RootLayout } from '@/components/layout/RootLayout'

import { ProtectedRoute } from './ProtectedRoute'
import { paths } from './paths'

// `lazy` needs a default export; the pages are named exports, so each import is
// mapped across. Keeping the pages as named exports means a typo at the import
// site is a build error rather than an undefined component at runtime.
const named = (loader, key) => lazy(() => loader().then((m) => ({ default: m[key] })))

const HomePage = named(() => import('@/pages/HomePage'), 'HomePage')
const QuickStartPage = named(() => import('@/pages/QuickStartPage'), 'QuickStartPage')
const LoginPage = named(() => import('@/pages/LoginPage'), 'LoginPage')
const RegisterPage = named(() => import('@/pages/RegisterPage'), 'RegisterPage')
const SpectatorPage = named(() => import('@/pages/SpectatorPage'), 'SpectatorPage')

const DashboardPage = named(() => import('@/pages/DashboardPage'), 'DashboardPage')
const TournamentsPage = named(() => import('@/pages/TournamentsPage'), 'TournamentsPage')
const TournamentDetailPage = named(
  () => import('@/pages/TournamentDetailPage'),
  'TournamentDetailPage',
)
const TeamGeneratorPage = named(() => import('@/pages/TeamGeneratorPage'), 'TeamGeneratorPage')
const StatsPage = named(() => import('@/pages/StatsPage'), 'StatsPage')
const BoardPage = named(() => import('@/pages/BoardPage'), 'BoardPage')
const RosterPage = named(() => import('@/pages/RosterPage'), 'RosterPage')
const FriendsPage = named(() => import('@/pages/FriendsPage'), 'FriendsPage')
const ProfilePage = named(() => import('@/pages/ProfilePage'), 'ProfilePage')
const NotFoundPage = named(() => import('@/pages/NotFoundPage'), 'NotFoundPage')

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
    children: [
      // ── Public ────────────────────────────────────────────────────────────
      {
        index: true,
        element: <HomePage />,
        handle: {
          title: 'Home',
          description:
            'Free tournament bracket generator and random team generator. Single and double elimination, round robin and Swiss, plus stats boards that track wins across game nights. No sign-up needed.',
        },
      },
      {
        path: paths.quickStart,
        element: <QuickStartPage />,
        handle: {
          title: 'New Tournament',
          description:
            'Make a tournament bracket in seconds. Single elimination, double elimination, round robin, Swiss and free-for-all, with best-of series and automatic seeding. Free, no account required.',
        },
      },
      { path: paths.login, element: <LoginPage />, handle: { title: 'Log in' } },
      { path: paths.register, element: <RegisterPage />, handle: { title: 'Sign up' } },
      // Deliberately outside ProtectedRoute: nine friends click this link and
      // none of them have an account.
      // The trailing name is decorative: the slug in front resolves the page,
      // so a renamed or mistyped tail still lands. `?` keeps the bare form
      // working, which is what every link shared before this looked like.
      {
        path: `${paths.spectate(':publicSlug')}/:name?`,
        element: <SpectatorPage />,
        handle: { title: 'Spectate' },
      },
      // These three are nav destinations that must work signed out — each has a
      // useful anonymous mode, and gating them would put the signup wall back
      // in front of the product (plan §4, NEW 6).
      {
        path: paths.tournaments,
        element: <TournamentsPage />,
        handle: {
          title: 'Tournaments',
          description:
            'Every bracket you host, help run or play in, with its format, entrants and winner.',
        },
      },
      {
        path: `${paths.tournament(':id')}/:name?`,
        element: <TournamentDetailPage />,
        // The readable tail of the URL is the tournament's own name, so the tab
        // can say which bracket this is without waiting for the fetch.
        handle: { title: (match) => titleFromSlug(match.params.name) ?? 'Tournament' },
      },
      {
        path: paths.teamGenerator,
        element: <TeamGeneratorPage />,
        handle: {
          title: 'Team Generator',
          description:
            'Paste a list of names and split them into balanced random teams. Keep two players apart, keep a pair together, and re-roll until the split looks right. Free team randomizer, no sign-up.',
        },
      },
      {
        path: paths.stats,
        element: <StatsPage />,
        handle: {
          title: 'Stats',
          description:
            'Build a stats board for your group. Track wins, losses and games played by player, tally by hand or let linked tournaments fill it in automatically.',
        },
      },
      // A board is shared by link, so reading one must work signed out.
      {
        path: `${paths.board(':slug')}/:name?`,
        element: <BoardPage />,
        handle: { title: (match) => titleFromSlug(match.params.name) ?? 'Stats' },
      },

      // ── Signed in ─────────────────────────────────────────────────────────
      {
        element: <ProtectedRoute />,
        children: [
          { path: paths.dashboard, element: <DashboardPage />, handle: { title: 'Dashboard' } },
          { path: paths.roster, element: <RosterPage />, handle: { title: 'My Roster' } },
          { path: paths.friends, element: <FriendsPage />, handle: { title: 'Friends' } },
          { path: paths.profile, element: <ProfilePage />, handle: { title: 'Profile' } },
        ],
      },

      { path: '*', element: <NotFoundPage />, handle: { title: 'Not found' } },
    ],
  },
])
