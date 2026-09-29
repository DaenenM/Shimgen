import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { EntrantsPanel } from '@/features/new-tournament/components/EntrantsPanel'
import { RosterRail } from '@/features/new-tournament/components/RosterRail'
import { SettingsPanel } from '@/features/new-tournament/components/SettingsPanel'
import { useNewTournamentForm } from '@/features/new-tournament/hooks/useNewTournamentForm'

// New tournament builder. Route: /new-tournament
// No login required (plan §4, NEW 6); anonymous brackets get a claim token.
export function QuickStartPage() {
  const form = useNewTournamentForm()

  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Container width matches the grid track so the title aligns over the rail. */}
      <div className="mx-auto w-full max-w-[69rem]">
        <PageHeader
          className="rise-in rise-delay-1"
          title="New tournament"
          description="Add names, pick a format, and you have a bracket. No account needed."
        />

        {/* Three columns so settings stay in view while the entrants list scrolls. */}
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,33rem)_20rem]">
          {/* self-start keeps the rail from stretching to the row's height. */}
          <RosterRail form={form} className="rise-in rise-delay-2 self-start lg:sticky lg:top-20" />
          <EntrantsPanel form={form} className="rise-in rise-delay-3" />
          <SettingsPanel form={form} className="rise-in rise-delay-4 lg:sticky lg:top-20" />
        </div>
      </div>
    </PageShell>
  )
}
