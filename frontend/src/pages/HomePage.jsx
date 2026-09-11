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
 */
export function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <section className="text-center">
        <div className="badge badge-primary badge-outline mb-4 gap-1">
          <Zap className="h-3 w-3" />
          No signup needed
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Brackets, teams and stats that <span className="text-primary">stick around</span>
        </h1>

        <p className="text-base-content/70 mx-auto mt-4 max-w-2xl text-lg text-pretty">
          Build a tournament in ten seconds, generate balanced teams, and keep the results that make
          next Saturday worth showing up for.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={paths.quickStart} className="btn btn-primary btn-lg gap-2">
            <Trophy className="h-5 w-5" />
            Create a bracket
          </Link>
          <Link to={paths.teamGenerator} className="btn btn-outline btn-lg gap-2">
            <Shuffle className="h-5 w-5" />
            Randomise teams
          </Link>
        </div>

        {!isAuthenticated && (
          <p className="text-base-content/50 mt-4 text-sm">
            Already have an account?{' '}
            <Link to={paths.login} className="link link-primary">
              Sign in
            </Link>
          </p>
        )}
      </section>

      <section className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Feature
          icon={Trophy}
          title="Every format, done properly"
          body="Single and double elimination with correct bracket reset, round robin, Swiss without rematches, and free-for-all lobbies."
        />
        <Feature
          icon={Shuffle}
          title="Teams that are actually fair"
          body="Keep two people apart, keep a pair together, or balance by rating so the strongest player doesn't decide the night."
        />
        <Feature
          icon={BarChart3}
          title="Stats that accumulate"
          body="Wins, streaks, head-to-head records and per-game ratings that carry across every night you play."
        />
        <Feature
          icon={Users}
          title="Your roster, saved"
          body="Type ten names once. Next week they're clickable chips, ordered by who played most recently."
        />
        <Feature
          icon={Link2}
          title="Share a link, not an invite"
          body="Every bracket gets a public read-only URL. You sign up; the other nine just click."
        />
        <Feature
          icon={Zap}
          title="Start before you sign up"
          body="Build the whole thing anonymously and claim it afterwards if you want to keep it."
        />
      </section>
    </div>
  )
}

function Feature({ icon: Icon, title, body }) {
  return (
    <div className="card bg-base-100 border-base-300 border transition-shadow hover:shadow-md">
      <div className="card-body gap-2">
        <Icon className="text-primary h-6 w-6" />
        <h3 className="card-title text-base">{title}</h3>
        <p className="text-base-content/60 text-sm">{body}</p>
      </div>
    </div>
  )
}
