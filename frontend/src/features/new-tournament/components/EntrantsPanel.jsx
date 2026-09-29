import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { RosterPicker } from '@/features/roster/components/RosterPicker'

import { TeamBuilder } from './team-builder/TeamBuilder'

// The third entry is the phone label, where three full ones do not fit.
const MODES = [
  ['solo', 'Solo players', 'Solo'],
  ['teams', 'Teams'],
  // Captains is still a list of solo players — the teams are what the draft
  // produces, not what the host types. It shares the solo entry box for
  // exactly that reason.
  ['captains', 'Team captains', 'Captains'],
]

/** Who is playing: the title, the entry mode, and the players or teams. */
export function EntrantsPanel({ form, className = '' }) {
  const { mode } = form

  return (
    <div className={`glass-panel min-w-0 ${className}`}>
      <div className="flex flex-col gap-5 p-5">
        <label className="flex w-full flex-col">
          <span className="label-text mb-1">
            Title <span className="text-base-content/40">(optional)</span>
          </span>
          <input
            type="text"
            className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-10 w-full px-3 text-sm transition-colors focus:outline-none"
            placeholder="Friday Night Showdown"
            value={form.title}
            onChange={(e) => form.setTitle(e.target.value)}
          />
        </label>

        <div>
          <SegmentedControl
            label="Who is entering"
            options={MODES}
            value={mode}
            onChange={form.setMode}
            // Full width: it heads the panel, and an inline switcher left a
            // ragged gap at its right end under the full-width title.
            block
            className="mb-4"
          />

          {/* The teams grow the page rather than scrolling inside a capped box:
              squeezed into one on a phone, the cards stacked on top of each
              other, and an expand toggle was one more thing to find. */}
          <div className={`flex flex-col ${mode === 'teams' ? '' : 'max-h-[calc(100vh-21rem)]'}`}>
            {mode === 'teams' ? (
              <TeamBuilder
                teams={form.teams}
                onChange={form.setTeams}
                activeTeam={form.activeTeam}
                onFocusTeam={form.setActiveTeam}
              />
            ) : (
              <RosterPicker
                value={form.rosterText}
                onChange={form.setRosterText}
                count={form.names.length}
                glass
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
