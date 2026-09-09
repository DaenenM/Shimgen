import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronDown, House, LogOut, Menu, Shuffle, Trophy, Users } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import { friends as friendsApi } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * The primary navigation.
 *
 * Every entry works signed out. Tournaments, the team generator and stats all
 * have a useful anonymous mode, and hiding them behind a login would put the
 * signup wall back in front of the product — which the plan identifies as the
 * main reason people reach for a random generator instead (plan §4, NEW 6).
 * Signing in adds persistence, not access.
 */
const NAV_LINKS = [
  { to: paths.home, label: 'Home', icon: House, end: true },
  { to: paths.teamGenerator, label: 'Team Generator', icon: Shuffle },
  { to: paths.tournaments, label: 'Tournaments', icon: Trophy },
  { to: paths.stats, label: 'Stats', icon: BarChart3 },
]

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header
      className="border-base-300/80 bg-base-100/80 sticky top-0 z-30 border-b backdrop-blur-xl"
      // The blur is what makes a sticky bar feel like it belongs to the page
      // rather than sitting on top of it — content passes under, tinted.
    >
      <div className="mx-auto flex h-16 max-w-[92rem] items-center gap-3 px-4">
        <MobileMenu />
        <Brand />

        <nav className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavItem {...link} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {isAuthenticated ? <AccountMenu user={user} onLogout={logout} /> : <SignedOutActions />}
        </div>
      </div>
    </header>
  )
}

function Brand() {
  return (
    <Link
      to={paths.home}
      className="group flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xl font-extrabold tracking-tight"
    >
      <span className="bg-primary/15 text-primary grid h-8 w-8 place-items-center rounded-lg transition-transform duration-300 ease-out group-hover:scale-105">
        <Trophy className="h-4.5 w-4.5" />
      </span>
      <span className="hidden sm:inline">
        shim<span className="text-primary">gen</span>
      </span>
    </Link>
  )
}

/**
 * One nav link.
 *
 * The underline is a scaled pseudo-element rather than an animated width or a
 * border: transform is the one property the compositor can animate without
 * re-laying-out the page, so it stays smooth while the bracket re-renders
 * behind it.
 */
/**
 * One nav destination.
 *
 * Hover does exactly one thing: the label brightens and the underline grows in
 * from the centre. There used to be three effects at once — a grey box behind
 * the text, the icon hopping upward, and the underline sweeping in from the
 * left — which read as busy rather than polished, and the box in particular
 * made the bar look like a row of buttons.
 */
function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-2 px-3 py-2 text-sm font-medium',
          'transition-colors duration-200',
          isActive ? 'text-primary' : 'text-base-content/60 hover:text-base-content',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-4 w-4" />
          {label}

          {/* Grown from the centre rather than swept from the left: a symmetric
              reveal reads as the item settling, where a left-to-right sweep
              reads as something loading. */}
          <span
            aria-hidden
            className={`bg-primary absolute inset-x-2 bottom-0 h-[2px] origin-center rounded-full transition-transform duration-300 ease-out ${
              isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
            }`}
          />
        </>
      )}
    </NavLink>
  )
}

function SignedOutActions() {
  return (
    <>
      <Link
        to={paths.login}
        className="text-base-content/60 hover:text-base-content hidden px-3 py-2 text-sm font-medium transition-colors duration-200 sm:block"
      >
        Log in
      </Link>

      <Link
        to={paths.register}
        className="bg-primary text-primary-content hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200"
      >
        Sign up
      </Link>
    </>
  )
}

function AccountMenu({ user, onLogout }) {
  // Friend requests are only visible on a page nobody opens speculatively, so
  // the nav has to be what says one arrived. Polled on a slow interval rather
  // than pushed: a request is not urgent, and this costs one small query.
  const { data: pending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: friendsApi.pending,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const waiting = pending?.length ?? 0

  // Initials rather than a generated avatar image: no network request, no
  // layout shift, and it still gives the menu a recognisable anchor.
  const initials = (user?.display_name || user?.username || '?').slice(0, 2).toUpperCase()

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        className="group text-base-content/70 hover:text-base-content flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 transition-colors duration-200"
        aria-label="Account menu"
      >
        <span className="relative">
          <span className="from-primary to-secondary text-primary-content grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-xs font-bold">
            {initials}
          </span>
          {/* A dot rather than a number: the menu below carries the count, and
              this only has to say "there is something in here". */}
          {waiting > 0 && (
            <span
              className="bg-primary border-base-100 absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
              aria-label={`${waiting} friend request${waiting === 1 ? '' : 's'} waiting`}
            />
          )}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
          {user?.display_name || user?.username}
        </span>
        <ChevronDown className="text-base-content/40 h-4 w-4 transition-transform duration-200 group-focus-within:rotate-180" />
      </button>

      <ul
        tabIndex={0}
        className="dropdown-content border-base-300 bg-base-100 z-40 mt-2 w-56 rounded-xl border p-1.5 shadow-2xl"
      >
        <li className="border-base-300/60 mb-1 border-b px-3 py-2">
          <p className="truncate text-sm font-semibold">{user?.display_name || user?.username}</p>
          <p className="text-base-content/50 truncate text-xs">{user?.email}</p>
        </li>

        <MenuLink to={paths.dashboard} label="Dashboard" />
        <MenuLink to={paths.roster} label="My Roster" />
        <MenuLink to={paths.groups} label="Groups" />
        <MenuLink to={paths.friends} label="Friends" icon={Users} badge={waiting} />
        <MenuLink to={paths.profile} label="Profile" />

        <li className="border-base-300/60 mt-1 border-t pt-1">
          <button
            onClick={onLogout}
            className="text-error hover:bg-error/10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150 hover:pl-4"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  )
}

function MenuLink({ to, label, icon: Icon, badge = 0 }) {
  return (
    <li>
      <Link
        to={to}
        className="hover:bg-primary/10 hover:text-primary flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:pl-4"
      >
        {label}
        <span className="flex items-center gap-2">
          {badge > 0 && (
            <span className="bg-primary text-primary-content rounded-full px-1.5 py-0.5 text-xs font-bold">
              {badge}
            </span>
          )}
          {Icon && <Icon className="h-4 w-4 opacity-40" />}
        </span>
      </Link>
    </li>
  )
}

function MobileMenu() {
  return (
    <div className="dropdown lg:hidden">
      <button
        tabIndex={0}
        className="text-base-content/70 hover:text-primary grid h-10 w-10 place-items-center rounded-lg transition-colors duration-200"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <ul
        tabIndex={0}
        className="dropdown-content border-base-300 bg-base-100 z-40 mt-2 w-60 rounded-xl border p-1.5 shadow-2xl"
      >
        {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-primary/10 hover:text-primary text-base-content/80',
                ].join(' ')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
