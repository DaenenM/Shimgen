import { BarChart3, Shuffle, Trophy } from '@/components/icons'
import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

/**
 * The site footer.
 *
 * Only links to pages that exist. A footer full of dead "Privacy" and "About"
 * links is the clearest possible signal that a site is unfinished — worse than
 * a short footer, which just reads as focused.
 *
 * Every destination here works signed out, which matters because the footer is
 * most visible to people who arrived on a shared spectator or board link and
 * have no account (plan §4, NEW 2).
 */

const TOOLS = [
  { to: paths.quickStart, label: 'New tournament', icon: Trophy },
  { to: paths.teamGenerator, label: 'Team generator', icon: Shuffle },
  { to: paths.stats, label: 'Stats boards', icon: BarChart3 },
]

const BROWSE = [
  { to: paths.home, label: 'Home' },
  { to: paths.tournaments, label: 'Tournaments' },
  { to: paths.register, label: 'Create an account' },
]

export function Footer() {
  return (
    <footer className="border-base-300 bg-base-100 text-base-content/70 mt-auto hidden border-t lg:block">
      <div className="mx-auto max-w-[92rem] px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          {/* Identity */}
          <div>
            <Link to={paths.home} className="inline-flex items-center gap-2">
              <span className="bg-primary/15 text-primary grid h-8 w-8 place-items-center rounded-lg">
                <Trophy className="h-4.5 w-4.5" />
              </span>
              <span className="text-base-content text-xl font-extrabold tracking-tight">
                shim<span className="text-primary">gen</span>
              </span>
            </Link>

            <p className="mt-3 max-w-sm text-sm">
              Brackets, team generation and stats that stick around. Built for the game night that
              happens every week.
            </p>
          </div>

          <FooterColumn title="Tools" links={TOOLS} />
          <FooterColumn title="Browse" links={BROWSE} />
        </div>

        <div className="border-base-300 mt-8 flex flex-col items-center justify-between gap-2 border-t pt-6 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} Shimgen. All rights reserved.</p>
          <p className="text-base-content/50">No account needed to build a bracket.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="text-base-content mb-3 text-sm font-semibold">{title}</h3>

      <ul className="space-y-2">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              // Colour only, matching the nav: a footer of boxes that light up
              // draws more attention than the links deserve.
              className="hover:text-primary inline-flex items-center gap-2 text-sm transition-colors duration-150"
            >
              {Icon && <Icon className="h-4 w-4 opacity-50" />}
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
