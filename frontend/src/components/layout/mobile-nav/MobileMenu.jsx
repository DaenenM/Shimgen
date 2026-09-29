import { BarChart3, House, Shuffle, Trophy } from '@/components/icons'
import { paths } from '@/routes/paths'

import { MobileAccountSection } from './MobileAccountSection'
import { MobileNavLink } from './MobileNavLink'

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

/** The sheet the phone bar's menu button opens, and the scrim behind it. */
export function MobileMenu({ panelRef, onClose }) {
  return (
    <>
      <div
        // A light blur rather than a heavy dim: the sheet above it is glass,
        // and a near-black scrim behind glass defeats the material — there is
        // nothing left to see through it.
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        // Hung from under the bar rather than filling the screen: a sheet that
        // stops short of the bottom still reads as a menu over the page, where
        // a full-height one reads as having navigated away.
        className="glass-raised fixed inset-x-2 top-[calc(3rem+env(safe-area-inset-top)+0.5rem)] z-50 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-2xl"
      >
        <nav className="p-2" aria-label="Primary">
          {LINKS.map((link) => (
            <MobileNavLink key={link.to} {...link} onNavigate={onClose} />
          ))}
        </nav>

        <MobileAccountSection onNavigate={onClose} />
      </div>
    </>
  )
}
