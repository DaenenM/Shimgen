import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { SavedRoster } from '@/features/roster/components/SavedRoster'
import { TeamResults } from '@/features/teams/components/TeamResults'
import { TeamSetupPanel } from '@/features/teams/components/TeamSetupPanel'
import { useTeamGenerator } from '@/features/teams/hooks/useTeamGenerator'

/** The team generator (plan §3). */
export function TeamGeneratorPage() {
  const gen = useTeamGenerator()

  // `wide` rather than the default: three columns, the last holding two team
  // cards side by side, does not fit in `normal` without squeezing the names in
  // each card down to a truncated column.
  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Header and grid share one container sized to exactly what the columns
          occupy — 13 + 22 + 28.75rem of track plus two 1.5rem gaps — so the
          title starts on the same line as the roster rail below it and the
          block is genuinely centred. */}
      <div className="mx-auto w-full max-w-[66.75rem]">
        <div className="rise-in rise-delay-1">
          <PageHeader
            title="Team Generator"
            description="Split a group into balanced teams, with the rules your crew actually needs."
          />
        </div>

        {/* Every column is sized to its contents rather than to a share of the
            row — the roster rail, a fixed-width form, and two team cards
            abreast all have a natural width. */}
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_22rem_28.75rem]">
          {/* Pinned from the column, the same as on the new-tournament form,
              so the rail stays in view while the setup and results scroll. */}
          <div className="rise-in rise-delay-2 min-w-0 self-start lg:sticky lg:top-20">
            <SavedRoster selected={gen.names} onAdd={gen.stageAdd} onRemove={gen.stageRemove} />
          </div>

          <TeamSetupPanel gen={gen} className="rise-in rise-delay-3" />

          {/* The animation sits on this column, never on the team cards inside
              it. The cards are rebuilt on every re-roll, so animating them
              would turn a page-load greeting into something that fires each
              time somebody presses Generate. */}
          <div className="rise-in rise-delay-4">
            <TeamResults gen={gen} />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
