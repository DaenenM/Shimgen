import { Shuffle } from '@/components/icons'
import { ACTION_BUTTON, ActionSheen } from '@/components/ui/ActionButton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { RosterPicker } from '@/features/roster/components/RosterPicker'

import { RulesPanel } from './RulesPanel'
import { TeamCountStepper } from './TeamCountStepper'

/** The team generator's form: players, team count, rules, and the generate button. */
export function TeamSetupPanel({ gen, className = '' }) {
  return (
    <div className={`glass-panel min-w-0 ${className}`}>
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
  )
}
