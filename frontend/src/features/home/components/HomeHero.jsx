import { Link } from 'react-router-dom'

import { Shuffle, Trophy } from '@/components/icons'
import { paths } from '@/routes/paths'

// Landing page hero: what Shimgen is in one line, plus the two primary CTAs.
// Used by HomePage.jsx. Copy is written for someone who has never run a
// bracket, so it says "tournament" and avoids format jargon.
export function HomeHero() {
  return (
    <section className="text-center">
      {/* Pill, not DaisyUI's outlined badge, to match the glass surfaces below. */}
      <span className="glass-inset text-base-content/70 rise-in rise-delay-1 mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
        Free <span className="text-base-content/30">·</span> No account needed
      </span>

      <h1 className="rise-in rise-delay-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
        Tournaments and teams for <span className="text-primary">game night</span>
      </h1>

      <p className="text-base-content/70 rise-in rise-delay-3 mx-auto mt-5 max-w-2xl text-lg text-pretty">
        Add names. Pick a game style. Start playing.
      </p>

      <div className="rise-in rise-delay-4 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {/* Only opaque element on the page — the primary action. */}
        <Link
          to={paths.quickStart}
          className="group bg-primary text-primary-content shadow-primary/20 hover:shadow-primary/30 relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-7 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:w-auto"
        >
          {/* Hover sheen; transform-only so it doesn't repaint the text. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
          <Trophy className="h-4.5 w-4.5 transition-transform duration-200 ease-out group-hover:-rotate-12" />
          New tournament
        </Link>

        {/* Glass counterpart: brightens/lifts on hover instead of glowing. */}
        <Link
          to={paths.teamGenerator}
          className="group glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-12 w-full items-center justify-center gap-2 px-7 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:w-auto"
        >
          <Shuffle className="h-4.5 w-4.5 transition-transform duration-300 ease-out group-hover:rotate-180" />
          Make random teams
        </Link>
      </div>
    </section>
  )
}
