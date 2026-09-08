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
const GroupsPage = named(() => import('@/pages/GroupsPage'), 'GroupsPage')
const GroupDetailPage = named(() => import('@/pages/GroupDetailPage'), 'GroupDetailPage')
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

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // ── Public ────────────────────────────────────────────────────────────
      { index: true, element: <HomePage /> },
      { path: paths.quickStart, element: <QuickStartPage /> },
      { path: paths.login, element: <LoginPage /> },
      { path: paths.register, element: <RegisterPage /> },
      // Deliberately outside ProtectedRoute: nine friends click this link and
      // none of them have an account.
      // The trailing name is decorative: the slug in front resolves the page,
      // so a renamed or mistyped tail still lands. `?` keeps the bare form
      // working, which is what every link shared before this looked like.
      { path: `${paths.spectate(':publicSlug')}/:name?`, element: <SpectatorPage /> },
      // These three are nav destinations that must work signed out — each has a
      // useful anonymous mode, and gating them would put the signup wall back
      // in front of the product (plan §4, NEW 6).
      { path: paths.tournaments, element: <TournamentsPage /> },
      { path: `${paths.tournament(':id')}/:name?`, element: <TournamentDetailPage /> },
      { path: paths.teamGenerator, element: <TeamGeneratorPage /> },
      { path: paths.stats, element: <StatsPage /> },
      // A board is shared by link, so reading one must work signed out.
      { path: `${paths.board(':slug')}/:name?`, element: <BoardPage /> },

      // ── Signed in ─────────────────────────────────────────────────────────
      {
        element: <ProtectedRoute />,
        children: [
          { path: paths.dashboard, element: <DashboardPage /> },
          { path: paths.groups, element: <GroupsPage /> },
          { path: paths.group(':slug'), element: <GroupDetailPage /> },
          { path: paths.roster, element: <RosterPage /> },
          { path: paths.friends, element: <FriendsPage /> },
          { path: paths.profile, element: <ProfilePage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
