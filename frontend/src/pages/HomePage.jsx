import { FeatureGrid } from '@/features/home/components/FeatureGrid'
import { HomeHero } from '@/features/home/components/HomeHero'

// Landing page. Route: / (home)
// Primary CTA is building a bracket, not signing up (plan §4, NEW 6).
export function HomePage() {
  return (
    <div className="glass-backdrop mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <HomeHero />

      <FeatureGrid />
    </div>
  )
}
