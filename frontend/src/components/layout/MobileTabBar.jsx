import { BarChart3, House, Shuffle, Trophy, Users } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

/**
 * The bottom tab bar, on phones only.
 *
 * A top nav is a website convention; a bottom bar is an app one, and this is a
 * tool used one-handed at a table while a game is being played. Thumbs reach
 * the bottom of a phone and not the top of it.
 *
 * Five destinations, which is the practical ceiling before targets get too
 * narrow to hit. Account is a drop-*up* rather than a link, because everything
 * behind it is occasional and it would otherwise spend a fifth of the bar on a
 * page nobody opens mid-night.
 *
 * Every tab works signed out — the same rule the top nav follows (plan §4,
 * NEW 6). Signing in adds persistence, not access.
 */

const TABS = [
  { to: paths.home, label: 'Home', icon: House, end: true },
  { to: paths.teamGenerator, label: 'Teams', icon: Shuffle },
  { to: paths.tournaments, label: 'Tournaments', icon: Trophy },
  { to: paths.stats, label: 'Stats', icon: BarChart3 },
]

export function MobileTabBar() {
  const { isAuthenticated, user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const container = useRef(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event) => {
      if (!container.current?.contains(event.target)) setMenuOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const accountLinks = isAuthenticated
    ? [
        { to: paths.dashboard, label: 'Dashboard' },
        { to: paths.roster, label: 'My roster' },
        { to: paths.friends, label: 'Friends' },
        { to: paths.profile, label: 'Profile' },
      ]
    : [
        { to: paths.login, label: 'Log in' },
        { to: paths.register, label: 'Create an account' },
      ]

  return (
    <div ref={container} className="lg:hidden">
      {/* The sheet sits above the bar and below the backdrop-blurred chrome, so
          a long list of links stays legible over whatever it covers. */}
      {menuOpen && (
        <>
          <div
            // Light blur rather than a heavier dim: the sheet above it is
            // glass, and a near-black scrim behind glass defeats the point of
            // the material — there is nothing left to see through it.
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />

          <div className="glass-raised fixed right-2 bottom-[4.5rem] left-2 z-50 overflow-hidden rounded-2xl">
            {isAuthenticated && (
              <div className="border-base-content/10 border-b px-4 py-3">
                <p className="truncate text-sm font-semibold">{user?.name ?? 'Signed in'}</p>
              </div>
            )}

            <nav className="p-2">
              {accountLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="hover:bg-base-content/8 flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                  className="text-error hover:bg-error/10 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium transition-colors"
                >
                  Log out
                </button>
              )}
            </nav>
          </div>
        </>
      )}

      <nav
        // `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of the home
        // indicator on notched iPhones, where the last few pixels are not
        // tappable.
        className="glass-chrome glass-chrome-bottom fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {/* No max-width: five equal tabs should span the phone, not sit in a
            column down the middle of it. `min-w-0` on each is what lets the
            labels truncate instead of forcing the row wider than the screen. */}
        <ul className="flex items-stretch">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="min-w-0 flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  // 3.5rem tall: comfortably past the 44px minimum touch target,
                  // and tall enough that icon and label both breathe.
                  `flex h-14 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium transition-colors sm:text-[0.6875rem] ${
                    isActive ? 'text-primary' : 'text-base-content/55'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? '' : 'opacity-80'}`} />
                    <span className="max-w-full truncate px-0.5 leading-none">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium transition-colors sm:text-[0.6875rem] ${
                menuOpen ? 'text-primary' : 'text-base-content/55'
              }`}
            >
              <Users className={`h-5 w-5 shrink-0 ${menuOpen ? '' : 'opacity-80'}`} />
              <span className="max-w-full truncate px-0.5 leading-none">Account</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
