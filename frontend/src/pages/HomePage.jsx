import { AccountPrompt } from '@/features/home/components/AccountPrompt'
import { ExtrasList } from '@/features/home/components/ExtrasList'
import { HomeHero } from '@/features/home/components/HomeHero'
import { HowItWorks } from '@/features/home/components/HowItWorks'
import { ToolGrid } from '@/features/home/components/ToolGrid'

// Landing page. Route: / (home)
// Primary CTA is starting a tournament, not signing up (plan §4, NEW 6).
export function HomePage() {
  return (
    <div className="glass-backdrop mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <HomeHero />
      <HowItWorks />
      <ToolGrid />
      <ExtrasList />
      <AccountPrompt />
    </div>
  )
}
