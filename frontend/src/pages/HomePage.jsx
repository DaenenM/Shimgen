import { FeatureGrid } from '@/features/home/components/FeatureGrid'
import { HomeHero } from '@/features/home/components/HomeHero'

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
  return (
    <div className="glass-backdrop mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <HomeHero />

      <FeatureGrid />
    </div>
  )
}
