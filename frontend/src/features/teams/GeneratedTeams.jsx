import { Link2 } from '@/components/icons'
import { Link } from 'react-router-dom'

import { ACTION_BUTTON, ActionSheen } from '@/components/ui/ActionButton'
import { paths } from '@/routes/paths'

import { TeamCardShell } from './TeamCardShell'

/**
 * The rolled teams, and the way on to a bracket.
 *
 * Capped at two team cards plus their gap, so the button lines up with the
 * cards rather than running out to the full column width beside them.
 */
export function GeneratedTeams({ teams, teamNames, nameFor, onRename }) {
  return (
    <div className="max-w-[28.75rem] space-y-4">
      {/* Two across, but each column capped rather than splitting the full
          width: a team card is a short list of names, and at the column's
          natural width it was mostly empty space with a name stranded on the
          left. `justify-start` keeps the pair against the left edge. */}
      <div className="grid justify-start gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
        {teams.map((team, index) => (
          <GeneratedTeamCard
            key={index}
            index={index}
            players={team}
            name={teamNames[index] ?? ''}
            onRename={(name) => onRename(index, name)}
          />
        ))}
      </div>

      {/* One way out of this page for every team count. The two-team case used
          to swap in a different panel with its own small "Set up" button, so
          the button moved and changed shape depending on how many teams came
          back. */}
      <Link
        to={paths.quickStart}
        state={{
          names: teams.map((_, i) => nameFor(i)),
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

function GeneratedTeamCard({ index, players, name, onRename }) {
  return (
    <TeamCardShell index={index} name={name} onRename={onRename} count={players.length}>
      <ul className="space-y-1">
        {players.map((player) => (
          <li key={player.id} className="text-sm">
            {player.name}
          </li>
        ))}
      </ul>
    </TeamCardShell>
  )
}
