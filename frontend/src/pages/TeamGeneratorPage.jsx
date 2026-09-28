import { Shuffle } from '@/components/icons'

import { PageShell } from '@/components/layout/PageShell'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { RosterPicker } from '@/components/ui/RosterPicker'
import { SavedRoster } from '@/components/ui/SavedRoster'
import { ACTION_BUTTON, ActionSheen } from '@/components/ui/ActionButton'
import { GeneratedTeams } from '@/features/teams/GeneratedTeams'
import { RulesPanel } from '@/features/teams/RulesPanel'
import { TeamCountStepper } from '@/features/teams/TeamCountStepper'
import { useTeamGenerator } from '@/features/teams/useTeamGenerator'

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

          <div className="glass-panel rise-in rise-delay-3 min-w-0">
            <div className="flex flex-col gap-5 p-5">
              <RosterPicker
                value={gen.rosterText}
                onChange={gen.setRosterText}
                count={gen.names.length}
                glass
                onClear={gen.clearEverything}
              />

              <TeamCountStepper
                count={gen.teamCount}
                playerCount={gen.names.length}
                onChange={gen.setTeamCount}
              />

              <RulesPanel
                names={gen.names}
                draft={gen.draft}
                onDraftChange={gen.setDraft}
                rules={gen.liveConstraints}
                onAdd={gen.addConstraint}
                onRemove={gen.removeConstraint}
              />

              <ErrorAlert>{gen.error}</ErrorAlert>

              <button className={ACTION_BUTTON} disabled={!gen.canGenerate} onClick={gen.generate}>
                <ActionSheen />
                {/* The shuffle mark turning is the one icon animation that says
                    what the button does, so it is worth the rotation. */}
                <Shuffle className="h-4 w-4 transition-transform duration-300 ease-out group-hover:rotate-180" />
                {gen.result ? 'Re-roll teams' : 'Generate teams'}
              </button>
            </div>
          </div>

          {/* The animation sits on this column, never on the team cards inside
              it. The cards are rebuilt on every re-roll, so animating them
              would turn a page-load greeting into something that fires each
              time somebody presses Generate. */}
          <div className="rise-in rise-delay-4">
            {gen.result ? (
              <GeneratedTeams
                teams={gen.result.teams}
                teamNames={gen.teamNames}
                nameFor={gen.nameFor}
                onRename={gen.renameTeam}
                onArrange={gen.arrangeTeams}
              />
            ) : (
              <div className="border-base-content/12 text-base-content/40 flex h-full min-h-[16rem] items-center justify-center rounded-[1.25rem] border border-dashed p-8 text-center text-sm">
                Your teams will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
