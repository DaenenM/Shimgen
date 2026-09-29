import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { EntrantsPanel } from '@/features/new-tournament/components/EntrantsPanel'
import { RosterRail } from '@/features/new-tournament/components/RosterRail'
import { SettingsPanel } from '@/features/new-tournament/components/SettingsPanel'
import { useNewTournamentForm } from '@/features/new-tournament/hooks/useNewTournamentForm'

/**
 * Build a tournament, with or without an account.
 *
 * Nothing here requires a login (plan §4, NEW 6). An anonymous bracket comes
 * back with a claim token, so it can be attached to an account afterwards.
 */
export function QuickStartPage() {
  const form = useNewTournamentForm()

  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Header and grid share one container sized to exactly what the columns
          occupy — 13 + 33 + 20rem of track plus two 1.5rem gaps — so the title
          starts on the same line as the roster rail and the block is centred,
          the same arrangement the Team Generator uses. */}
      <div className="mx-auto w-full max-w-[69rem]">
        <PageHeader
          className="rise-in rise-delay-1"
          title="New tournament"
          description="Add names, pick a format, and you have a bracket. No account needed."
        />

        {/* Three columns rather than one long page. With a dozen teams the
            format choices and the create button were several screens below the
            fold, so the list scrolls inside its own column and the settings stay
            in view. The roster sits beside the form rather than in it, so the
            names people are about to click are not below the box they are
            typing in. The middle column is capped at 33rem: wide enough for two
            team cards abreast, without stretching the form across the screen. */}
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,33rem)_20rem]">
          {/* `self-start` sits on the rail because the rail is the grid item:
              without it the roster rail stretches to the row's height. */}
          <RosterRail form={form} className="rise-in rise-delay-2 self-start lg:sticky lg:top-20" />
          <EntrantsPanel form={form} className="rise-in rise-delay-3" />
          <SettingsPanel form={form} className="rise-in rise-delay-4 lg:sticky lg:top-20" />
        </div>
      </div>
    </PageShell>
  )
}
