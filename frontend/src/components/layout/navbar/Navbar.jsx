import { BarChart3, House, Shuffle, Trophy } from '@/components/icons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { paths } from '@/routes/paths'

import { Brand } from '../Brand'
import { AccountMenu } from './AccountMenu'
import { NavItem } from './NavItem'
import { SignedOutActions } from './SignedOutActions'

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
      // Phones navigate from the bottom tab bar instead: two navigations on one
      // small screen is redundant, and the top one costs a sixth of the
      // viewport before any content is shown.
      className="glass-chrome glass-chrome-top sticky top-0 z-30 hidden lg:block"
      // The blur is what makes a sticky bar feel like it belongs to the page
      // rather than sitting on top of it — content passes under, tinted. The
      // saturation in `glass-chrome` is what keeps that from going grey.
    >
      <div className="mx-auto flex h-[4.25rem] max-w-[92rem] items-center gap-3 px-4">
        <Brand />

        <nav className="flex flex-1 justify-center">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavItem {...link} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? <AccountMenu user={user} onLogout={logout} /> : <SignedOutActions />}
        </div>
      </div>
    </header>
  )
}
