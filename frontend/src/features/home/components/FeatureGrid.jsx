import { BarChart3, Link2, Shuffle, Trophy, Users, Zap } from '@/components/icons'

import { FeatureCard } from './FeatureCard'

/**
 * What the product does, one card per promise.
 *
 * The cards come in after the pitch above them, continuing the same
 * stagger rather than starting a second one — so the page reads as one
 * thing settling top to bottom.
 *
 * One step each rather than shared delays. Pairing them put four cards
 * on the screen at the same instant, which broke the cascade into two
 * clumps; a step apiece keeps it reading as one movement travelling down
 * the grid.
 *
 * The delay is a prop rather than a `:nth-child` rule because the visual
 * order is the source order here, and a stylesheet rule would silently
 * mis-time them the moment a card is added or reordered.
 */
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
