import { Link } from 'react-router-dom'

import { Shuffle, Trophy, Zap } from '@/components/icons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { paths } from '@/routes/paths'

/** The landing page's pitch and its two ways in. */
export function HomeHero() {
  const { isAuthenticated } = useAuth()

  return (
    <section className="text-center">
      {/* The badge is the page's smallest piece of glass — a pill rather than
          DaisyUI's outlined badge, so it belongs to the same material as the
          panels below it. */}
      <span className="glass-inset text-base-content/70 rise-in rise-delay-1 mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
        <Zap className="text-primary h-3.5 w-3.5" />
        No signup needed
      </span>

      <h1 className="rise-in rise-delay-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
        Brackets, teams and stats that <span className="text-primary">stick around</span>
      </h1>

      <p className="text-base-content/70 rise-in rise-delay-3 mx-auto mt-5 max-w-2xl text-lg text-pretty">
        Build a tournament in ten seconds, generate balanced teams, and keep the results that make
        next Saturday worth showing up for.
      </p>

      <div className="rise-in rise-delay-4 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {/* The one opaque thing on the page, and the one thing the page is
            for. Everything else is glass, so this reads as the way forward
            without needing to be bigger than everything else.

            On hover it lifts and its glow spreads — light behaving the way
            the rest of the material does, rather than the button simply
            getting darker. `-translate-y-0.5` is deliberately small: this is
            a page element settling, not a card flying up. */}
        <Link
          to={paths.quickStart}
          className="group bg-primary text-primary-content shadow-primary/20 hover:shadow-primary/30 relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-7 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:w-auto"
        >
          {/* A sheen that crosses the button once per hover. Pure transform,
              so it composites without repainting the text underneath. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
          <Trophy className="h-4.5 w-4.5 transition-transform duration-200 ease-out group-hover:-rotate-12" />
          Create a bracket
        </Link>

        {/* The glass counterpart: it brightens and lifts rather than glowing,
            since a translucent surface catching more light is what "raised"
            looks like in this material. */}
        <Link
          to={paths.teamGenerator}
          className="group glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-12 w-full items-center justify-center gap-2 px-7 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:w-auto"
        >
          <Shuffle className="h-4.5 w-4.5 transition-transform duration-300 ease-out group-hover:rotate-180" />
          Randomise teams
        </Link>
      </div>

      {!isAuthenticated && (
        <p className="text-base-content/50 rise-in rise-delay-5 mt-5 text-sm">
          Already have an account?{' '}
          <Link to={paths.login} className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </section>
  )
}
