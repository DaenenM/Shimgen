import { Link2 } from '@/components/icons'
import { Link } from 'react-router-dom'

import { ACTION_BUTTON, ActionSheen } from '@/components/ui/ActionButton'
import { paths } from '@/routes/paths'

import { TeamCardShell } from './TeamCardShell'
import { DraggableMembers, TeamDragProvider } from './TeamDrag'
import { useTeamDropTarget } from './teamDragState'

/**
 * The rolled teams, and the way on to a bracket.
 *
 * Players can be dragged from one team to another, or reordered within one,
 * when the roll is nearly right — the same drag as the new-tournament form's
 * team builder (`TeamDrag`), so it looks and moves identically on both pages.
 * Keyed by player id rather than name: two players may share a name, and a
 * drag must move exactly one of them.
 *
 * Capped at two team cards plus their gap, so the button lines up with the
 * cards rather than running out to the full column width beside them.
 */
export function GeneratedTeams({ teams, teamNames, nameFor, onRename, onArrange }) {
  const labels = new Map(teams.flat().map((player) => [String(player.id), player.name]))
  const labelOf = (id) => labels.get(id) ?? ''

  return (
    <div className="max-w-[28.75rem] space-y-4">
      <TeamDragProvider
        groups={teams.map((team) => team.map((player) => String(player.id)))}
        onChange={onArrange}
        labelOf={labelOf}
      >
        {/* Two across, but each column capped rather than splitting the full
            width: a team card is a short list of names, and at the column's
            natural width it was mostly empty space with a name stranded on the
            left. `justify-start` keeps the pair against the left edge. */}
        <div className="grid items-start justify-start gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
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

      {/* One way out of this page for every team count. The two-team case used
          to swap in a different panel with its own small "Set up" button, so
          the button moved and changed shape depending on how many teams came
          back. */}
      <Link
        to={paths.quickStart}
        state={{
          // The players, not the team names: this seeds the solo and captains
          // box, which takes people. Team names there turned "Team 1" into a
          // player the moment the host switched mode.
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

function GeneratedTeamCard({ index, ids, labelOf, name, onRename }) {
  const drop = useTeamDropTarget(index)

  return (
    <TeamCardShell
      innerRef={drop.ref}
      index={index}
      name={name}
      onRename={onRename}
      count={ids.length}
      className={drop.highlight.className}
      style={drop.highlight.style}
    >
      {/* No remove button: a rolled team is rearranged, not edited. Players
          are added or taken out in the list on the left, and a re-roll. */}
      <DraggableMembers index={index} keys={ids} labelOf={labelOf} emptyText="Nobody left" />
    </TeamCardShell>
  )
}
