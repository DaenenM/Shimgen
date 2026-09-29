import { BarChart3, Link2, Shuffle, Trophy, Users, Zap } from '@/components/icons'

import { FeatureCard } from './FeatureCard'

// Feature cards grid. Used by HomePage.jsx.
// Each card gets its own rise-delay step (not paired) to keep the cascade
// reading as one continuous movement down the grid.
export function FeatureGrid() {
  return (
    <section className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FeatureCard
        icon={Trophy}
        title="Every format, done properly"
        body="Single and double elimination with correct bracket reset, round robin, Swiss without rematches, and free-for-all lobbies."
        delay="rise-delay-3"
      />
      <FeatureCard
        icon={Shuffle}
        title="Teams that are actually fair"
        body="Keep two people apart, keep a pair together, or balance by rating so the strongest player doesn't decide the night."
        delay="rise-delay-4"
      />
      <FeatureCard
        icon={BarChart3}
        title="Stats that accumulate"
        body="Wins, streaks, head-to-head records and per-game ratings that carry across every night you play."
        delay="rise-delay-5"
      />
      <FeatureCard
        icon={Users}
        title="Your roster, saved"
        body="Type ten names once. Next week they're clickable chips, ordered by who played most recently."
        delay="rise-delay-6"
      />
      <FeatureCard
        icon={Link2}
        title="Share a link, not an invite"
        body="Every bracket gets a public read-only URL. You sign up; the other nine just click."
        delay="rise-delay-7"
      />
      <FeatureCard
        icon={Zap}
        title="Start before you sign up"
        body="Build the whole thing anonymously and claim it afterwards if you want to keep it."
        delay="rise-delay-8"
      />
    </section>
  )
}
