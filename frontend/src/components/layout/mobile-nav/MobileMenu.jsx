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

// Sheet opened by the phone bar's menu button, plus its scrim. Used by MobileNav.jsx.
export function MobileMenu({ panelRef, onClose }) {
  return (
    <>
      <div
        // Light blur, not a heavy dim — the sheet above is glass and needs something to show through.
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        // Stops short of the bottom so it reads as a menu, not a full navigation.
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
