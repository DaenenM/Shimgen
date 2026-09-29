import { Plus } from '@/components/icons'
import { useAutoSaveRoster } from '@/features/roster/hooks/useAutoSaveRoster'
import { useRoster } from '@/features/roster/hooks/useRoster'
import { TeamDragProvider } from '@/features/teams/components/drag/TeamDragProvider'

import { AddPlayersBar } from './AddPlayersBar'
import { BuilderTeamCard } from './BuilderTeamCard'

// Build teams by hand (the counterpart to the random team generator). Used by EntrantsPanel.jsx.
// Each team is `{ label, members }`, matching the API's `entrant_teams` shape directly.
// Names are unique across the whole form, so a name doubles as its own drag key.
// Drag-and-drop between teams reuses TeamDragProvider, shared with the generator.
export function TeamBuilder({ teams, onChange, activeTeam = 0, onFocusTeam = () => {} }) {
  const { remember } = useRoster()
  const [autoSave] = useAutoSaveRoster()
  const update = (index, patch) =>
    onChange(teams.map((team, i) => (i === index ? { ...team, ...patch } : team)))

  // Where typed names go; clamped so deleting the last team can't leave this past the end.
  const target = Math.min(activeTeam, teams.length - 1)

  const addTeam = () => onChange([...teams, { label: '', members: [] }])
  const removeTeam = (index) => {
    onChange(teams.filter((_, i) => i !== index))
    // Keep the target pointing at a team that still exists.
    if (index < activeTeam || activeTeam >= teams.length - 1) {
      onFocusTeam(Math.max(0, activeTeam - 1))
    }
  }

  // Everyone already on any team, so a name taken elsewhere can't be added again.
  const assigned = new Set(teams.flatMap((team) => team.members.map((name) => name.toLowerCase())))

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex shrink-0 items-baseline justify-between">
        <span className="text-sm font-medium">
          Teams <span className="text-base-content/50">({teams.length})</span>
        </span>
        {teams.length > 0 && (
          <button
            type="button"
            className="text-base-content/50 hover:text-base-content text-xs transition-colors"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
      </div>

      {teams.length > 0 && (
        <AddPlayersBar
          teams={teams}
          target={target}
          assigned={assigned}
          onTarget={onFocusTeam}
          onAdd={(names) => {
            update(target, { members: [...teams[target].members, ...names] })
            // Typed names go to the roster too, unless autoSave is off.
            if (autoSave) remember(names)
          }}
        />
      )}

      <TeamDragProvider
        groups={teams.map((team) => team.members)}
        onChange={(groups) =>
          onChange(teams.map((team, index) => ({ ...team, members: groups[index] })))
        }
        labelOf={(name) => name}
        // Focus the team a player was just dropped into.
        onDropped={onFocusTeam}
      >
        {/* Container query (not breakpoint): two across once this column is wide enough. */}
        <ul className="grid grid-cols-1 items-start gap-3 @md:grid-cols-2">
          {teams.map((team, index) => (
            <BuilderTeamCard
              key={index}
              team={team}
              index={index}
              active={index === target}
              onFocus={() => onFocusTeam(index)}
              onUpdate={(patch) => update(index, patch)}
              onRemove={() => removeTeam(index)}
            />
          ))}
        </ul>
      </TeamDragProvider>

      <button
        type="button"
        onClick={addTeam}
        className="border-base-content/15 text-base-content/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium transition-colors duration-150"
      >
        <Plus className="h-4 w-4" />
        Add a team
      </button>

      {teams.length === 1 && (
        <p className="text-base-content/50 text-center text-xs">
          A tournament needs at least two teams.
        </p>
      )}
    </div>
  )
}
