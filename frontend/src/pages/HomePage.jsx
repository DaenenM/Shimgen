import { BarChart3, Link2, Shuffle, Trophy, Users, Zap } from '@/components/icons'
import { Link } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

/**
 * The landing page.
 *
 * The primary call to action is building a bracket, not signing up. The whole
 * wedge is that the tool works before you have an account and gets better once
 * you do (plan §4, NEW 6).
 *
 * Styled to the glass system the Team Generator established: an ambient mesh
 * behind, translucent panels over it, and exactly one opaque element — the
 * primary action. Two solid buttons side by side would make neither of them
 * the answer to "what do I do here".
 */
export function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="glass-backdrop mx-auto max-w-6xl px-4 py-12 sm:py-16">
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

      {/* The cards come in after the pitch above them, continuing the same
          stagger rather than starting a second one — so the page reads as one
          thing settling top to bottom.

          One step each rather than shared delays. Pairing them put four cards
          on the screen at the same instant, which broke the cascade into two
          clumps; a step apiece keeps it reading as one movement travelling down
          the grid.

          The delay is a prop rather than a `:nth-child` rule because the visual
          order is the source order here, and a stylesheet rule would silently
          mis-time them the moment a card is added or reordered. */}
      <section className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feature
          icon={Trophy}
          title="Every format, done properly"
          body="Single and double elimination with correct bracket reset, round robin, Swiss without rematches, and free-for-all lobbies."
          delay="rise-delay-3"
        />
        <Feature
          icon={Shuffle}
          title="Teams that are actually fair"
          body="Keep two people apart, keep a pair together, or balance by rating so the strongest player doesn't decide the night."
          delay="rise-delay-4"
        />
        <Feature
          icon={BarChart3}
          title="Stats that accumulate"
          body="Wins, streaks, head-to-head records and per-game ratings that carry across every night you play."
          delay="rise-delay-5"
        />
        <Feature
          icon={Users}
          title="Your roster, saved"
          body="Type ten names once. Next week they're clickable chips, ordered by who played most recently."
          delay="rise-delay-6"
        />
        <Feature
          icon={Link2}
          title="Share a link, not an invite"
          body="Every bracket gets a public read-only URL. You sign up; the other nine just click."
          delay="rise-delay-7"
        />
        <Feature
          icon={Zap}
          title="Start before you sign up"
          body="Build the whole thing anonymously and claim it afterwards if you want to keep it."
          delay="rise-delay-8"
        />
      </section>
    </div>
  )
}

/**
 * One selling point.
 *
 * The icon sits in its own tinted tile rather than loose above the heading: at
 * six cards the loose icons read as a scattered column of blue marks, where the
 * tiles give each card a consistent anchor.
 */
function Feature({ icon: Icon, title, body, delay = '' }) {
  return (
    <div
      className={`glass-panel hover:border-base-content/20 rise-in ${delay} p-5 transition-colors duration-200`}
    >
      <span className="bg-primary/15 text-primary mb-3 grid h-10 w-10 place-items-center rounded-xl">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-base-content/60 mt-1.5 text-sm">{body}</p>
    </div>
  )
}
