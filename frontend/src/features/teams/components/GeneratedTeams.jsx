import { Link } from 'react-router-dom'

import { Link2 } from '@/components/icons'
import { ACTION_BUTTON, ActionSheen } from '@/components/ui/ActionButton'
import { paths } from '@/routes/paths'

import { TeamDragProvider } from './drag/TeamDragProvider'
import { GeneratedTeamCard } from './GeneratedTeamCard'

// The rolled teams, draggable, plus the link into a bracket. Used by TeamResults.jsx.
// Keyed by player id, not name, since two players can share a name.
export function GeneratedTeams({ teams, teamNames, nameFor, onRename, onArrange }) {
  const labels = new Map(teams.flat().map((player) => [String(player.id), player.name]))
  const labelOf = (id) => labels.get(id) ?? ''

  return (
    <div className="space-y-4 lg:max-w-[28.75rem]">
      <TeamDragProvider
        groups={teams.map((team) => team.map((player) => String(player.id)))}
        onChange={onArrange}
        labelOf={labelOf}
      >
        {/* Full width when stacked, so cards line up with the setup panel above;
            two across from sm, where the lg column cap keeps them from stretching. */}
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {teams.map((team, index) => (
            <GeneratedTeamCard
              key={index}
              index={index}
              ids={team.map((player) => String(player.id))}
              labelOf={labelOf}
              name={teamNames[index] ?? ''}
              onRename={(name) => onRename(index, name)}
            />
          ))}
        </div>
      </TeamDragProvider>

      {/* One consistent way out of this page, regardless of team count. */}
      <Link
        to={paths.quickStart}
        state={{
          // Players, not team names — the quick-start box takes people.
          names: teams.flatMap((team) => team.map((p) => p.name)),
          squads: teams.map((team, i) => ({
            label: nameFor(i),
            members: team.map((p) => p.name),
          })),
        }}
        className={ACTION_BUTTON}
      >
        <ActionSheen />
        <Link2 className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-rotate-12" />
        Put these teams in a bracket
      </Link>
    </div>
  )
}
