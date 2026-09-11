import { BarChart3, House, Menu, Shuffle, Trophy, X } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

/**
 * The phone navigation: a top bar with a hamburger, and the sheet it opens.
 *
 * This replaced a bottom tab bar. Five fixed tabs could only ever show four
 * destinations plus an overflow menu, so Account — and everything real behind
 * it — lived in a drop-up nobody found, while the bar itself spent 4rem of a
 * short viewport on every single screen whether it was wanted or not.
 *
 * A sheet costs one tap to open and gives the whole width back to the page. It
 * also has room to say what each destination *is*, which four 10px labels
 * under four glyphs never did.
 *
 * Every entry works signed out — the same rule the top nav follows (plan §4,
 * NEW 6). Signing in adds persistence, not access.
 */

const LINKS = [
  { to: paths.home, label: 'Home', icon: House, end: true, hint: 'Start here' },
  {
    to: paths.teamGenerator,
    label: 'Team Generator',
    icon: Shuffle,
    hint: 'Split players into balanced teams',
  },
  { to: paths.tournaments, label: 'Tournaments', icon: Trophy, hint: 'Your brackets' },
  { to: paths.stats, label: 'Stats', icon: BarChart3, hint: 'Boards and leaderboards' },
]

export function MobileNav() {
  const { isAuthenticated, user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const panel = useRef(null)
  const toggle = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      // The toggle is excluded as well as the sheet. It lives in the header,
      // outside the panel, so a press on it counted as "outside" and closed
      // the sheet on mousedown — then its own click fired and toggled it
      // straight back open. Tapping the X appeared to do nothing at all.
      if (panel.current?.contains(event.target)) return
      if (toggle.current?.contains(event.target)) return

      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    // The sheet covers the page, so scrolling should move the sheet's own list
    // rather than the bracket behind it.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [open])

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
    // `lg:hidden`: wide screens use the Navbar, which hides itself below `lg`.
    <div className="lg:hidden">
      <header
        // Anchored to the top and blurred, so the page scrolls under it rather
        // than being pushed down by it. `env(safe-area-inset-top)` clears the
        // notch on an iPhone, where the first ~47px are behind the status bar.
        //
        // 3rem is the floor: the toggle inside is 2.75rem, the smallest
        // comfortable touch target, so a thinner bar would have to shrink the
        // one thing on it anybody presses.
        className="glass-chrome glass-chrome-top fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]"
      >
        <div className="flex h-12 items-center justify-between px-4">
          <Brand onNavigate={() => setOpen(false)} />

          <button
            ref={toggle}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            // 44px square: the minimum comfortable touch target, and square so
            // the icon swap does not shift anything beside it.
            className="text-base-content/70 hover:bg-base-content/8 hover:text-base-content -mr-2 grid h-11 w-11 place-items-center rounded-xl transition-colors"
          >
            {open ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />}
          </button>
        </div>
      </header>

      {open && (
        <>
          <div
            // A light blur rather than a heavy dim: the sheet above it is
            // glass, and a near-black scrim behind glass defeats the material —
            // there is nothing left to see through it.
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div
            ref={panel}
            // Hung from under the bar rather than filling the screen: a sheet
            // that stops short of the bottom still reads as a menu over the
            // page, where a full-height one reads as having navigated away.
            className="glass-raised fixed inset-x-2 top-[calc(3rem+env(safe-area-inset-top)+0.5rem)] z-50 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-2xl"
          >
            <nav className="p-2" aria-label="Primary">
              {LINKS.map(({ to, label, icon: Icon, end, hint }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  // Closed here rather than by an effect watching the route: a
                  // tap is what dismisses the sheet, and calling setState from
                  // an effect cascades an extra render for no benefit.
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      isActive ? 'bg-primary/12 text-primary' : 'hover:bg-base-content/8'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          isActive ? 'bg-primary/15' : 'bg-base-content/8 text-base-content/60'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.9375rem] font-semibold">
                          {label}
                        </span>
                        <span className="text-base-content/50 block truncate text-xs">{hint}</span>
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="border-base-content/10 border-t p-2">
              {/* Named rather than assumed: "Account" is the word the header
                  uses, so the section under it says the same thing. */}
              <p className="text-base-content/45 px-3 pt-1 pb-1.5 text-xs font-semibold tracking-wide uppercase">
                {isAuthenticated ? (user?.name ?? 'Account') : 'Account'}
              </p>

              {accountLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="hover:bg-base-content/8 flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    logout()
                  }}
                  className="text-error hover:bg-error/10 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium transition-colors"
                >
                  Log out
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** The wordmark, matching the one the desktop navbar carries. */
function Brand({ onNavigate }) {
  return (
    <Link
      to={paths.home}
      onClick={onNavigate}
      className="flex items-center gap-2 text-base font-extrabold tracking-tight"
    >
      <span className="bg-primary/15 text-primary grid h-7 w-7 place-items-center rounded-lg">
        <Trophy className="h-4 w-4" />
      </span>
      <span>
        shim<span className="text-primary">gen</span>
      </span>
    </Link>
  )
}
