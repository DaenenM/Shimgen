import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { SavedRoster } from '@/features/roster/components/SavedRoster'
import { TeamResults } from '@/features/teams/components/TeamResults'
import { TeamSetupPanel } from '@/features/teams/components/TeamSetupPanel'
import { useTeamGenerator } from '@/features/teams/hooks/useTeamGenerator'

// Team generator. Route: /teams (plan §3)
export function TeamGeneratorPage() {
  const gen = useTeamGenerator()

  // `wide`: three columns with two team cards abreast don't fit `normal`.
  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Container width matches the grid track so the title aligns and centers. */}
      <div className="mx-auto w-full max-w-[66.75rem]">
        <div className="rise-in rise-delay-1">
          <PageHeader
            title="Team Generator"
            description="Split a group into balanced teams, with the rules your crew actually needs."
          />
        </div>

        {/* Columns sized to their natural content width, not to a row share. */}
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_22rem_28.75rem]">
          {/* Sticky rail stays in view while setup/results scroll. */}
          <div className="rise-in rise-delay-2 min-w-0 self-start lg:sticky lg:top-20">
            <SavedRoster selected={gen.names} onAdd={gen.stageAdd} onRemove={gen.stageRemove} />
          </div>

          <TeamSetupPanel gen={gen} className="rise-in rise-delay-3" />

          {/* Animation on the column, not the cards — cards rebuild on every re-roll. */}
          <div className="rise-in rise-delay-4">
            <TeamResults gen={gen} />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
