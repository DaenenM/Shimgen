import { Plus } from '@/components/icons'
import { useAutoSaveRoster } from '@/features/roster/hooks/useAutoSaveRoster'
import { useRoster } from '@/features/roster/hooks/useRoster'
import { TeamDragProvider } from '@/features/teams/components/drag/TeamDragProvider'

import { AddPlayersBar } from './AddPlayersBar'
import { BuilderTeamCard } from './BuilderTeamCard'

/**
 * Build teams by hand, rather than randomising them.
 *
 * The team generator answers "split these ten people fairly". This answers the
 * other half: the teams already exist — the same pairs turn up every Saturday —
 * and the host just needs to write them down. Players can be dragged between
 * teams (and reordered within one) when somebody lands on the wrong side; the
 * dragging itself is `TeamDrag`, shared with the generator.
 *
 * Each team is `{ label, members }`, which is exactly the `entrant_teams` shape
 * the API takes, so nothing has to be translated on submit. Names are unique
 * across the whole form (see `assigned`), so a name is its own drag key.
 *
 * The saved roster lives beside the form as its own column, and `activeTeam`
 * says which card its clicks land in.
 *
 * The list grows with its teams and the page scrolls — it is not capped into
 * a scroll box of its own. Capped, the cards crushed together on a phone.
 */
export function TeamBuilder({ teams, onChange, activeTeam = 0, onFocusTeam = () => {} }) {
  const { remember } = useRoster()
  const [autoSave] = useAutoSaveRoster()
  const update = (index, patch) =>
    onChange(teams.map((team, i) => (i === index ? { ...team, ...patch } : team)))

  // Where typed names go. Clamped, because deleting the last team would
  // otherwise leave the target pointing past the end of the list.
  const target = Math.min(activeTeam, teams.length - 1)

  const addTeam = () => onChange([...teams, { label: '', members: [] }])
  const removeTeam = (index) => {
    onChange(teams.filter((_, i) => i !== index))
    // Keep the target on a team that still exists, and on the same team when
    // one above it was removed, so the saved roster never fills a ghost.
    if (index < activeTeam || activeTeam >= teams.length - 1) {
      onFocusTeam(Math.max(0, activeTeam - 1))
    }
  }

  // Everyone already placed on any team. Nobody can play for two sides at
  // once, so a name taken elsewhere is neither suggested again nor accepted if
  // typed — computed across the whole tournament rather than per card.
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
            // Typed names go to the roster too, unless that is switched off
            // from the saved roster's header.
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
        // The team a player was dropped into is the one being worked on now.
        onDropped={onFocusTeam}
      >
        {/* Two across once the column is wide enough (28rem), one below it.
            A container query rather than a breakpoint: what matters is the
            width of this column, not the screen — two across in a narrow
            column truncated every team name to "Tea…". */}
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
