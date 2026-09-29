import { useTeamDropTarget } from '../hooks/useTeamDropTarget'
import { DraggableMembers } from './drag/DraggableMembers'
import { TeamCardShell } from './TeamCardShell'

// One rolled team card, draggable. Used by GeneratedTeams.jsx.
export function GeneratedTeamCard({ index, ids, labelOf, name, onRename }) {
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
      {/* No remove button: a rolled team is rearranged, not edited or removed from. */}
      <DraggableMembers index={index} keys={ids} labelOf={labelOf} emptyText="Nobody left" />
    </TeamCardShell>
  )
}
