import { Trash2 } from '@/components/icons'
import { DraggableMembers } from '@/features/teams/components/drag/DraggableMembers'
import { TeamCardShell } from '@/features/teams/components/TeamCardShell'
import { useTeamDropTarget } from '@/features/teams/hooks/useTeamDropTarget'
import { teamTone } from '@/features/teams/utils/tone'

// One team card in the manual team builder. Used by TeamBuilder.jsx.
export function BuilderTeamCard({ team, index, active, onFocus, onUpdate, onRemove }) {
  // Active card outlined in its own colour; drag-over outline (interactive blue) takes priority.
  const drop = useTeamDropTarget(index, active ? teamTone(index).edge : 'transparent')

  return (
    // Clicking the card sets it as the target for the names box and saved roster.
    <TeamCardShell
      as="li"
      innerRef={drop.ref}
      onClick={onFocus}
      index={index}
      name={team.label}
      onRename={(label) => onUpdate({ label })}
      count={team.members.length}
      surface="glass-inset"
      className={`cursor-pointer ${drop.highlight.className}`}
      style={drop.highlight.style}
      actions={
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove team ${index + 1}`}
          title="Remove this team"
          className="text-base-content/40 hover:text-error hover:bg-error/10 -mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors duration-150"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      }
    >
      <DraggableMembers
        index={index}
        keys={team.members}
        labelOf={(name) => name}
        onRemove={(name) => onUpdate({ members: team.members.filter((m) => m !== name) })}
        removeLabel={(name) => `Remove ${name} from team ${index + 1}`}
      />
    </TeamCardShell>
  )
}
