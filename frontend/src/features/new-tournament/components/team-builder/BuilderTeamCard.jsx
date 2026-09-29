import { Trash2 } from '@/components/icons'
import { DraggableMembers } from '@/features/teams/components/drag/DraggableMembers'
import { TeamCardShell } from '@/features/teams/components/TeamCardShell'
import { useTeamDropTarget } from '@/features/teams/hooks/useTeamDropTarget'
import { teamTone } from '@/features/teams/utils/tone'

export function BuilderTeamCard({ team, index, active, onFocus, onUpdate, onRemove }) {
  // The chosen card is outlined in its own colour at rest; a card being dragged
  // over is outlined in the interactive blue, which wins while a drag is live.
  const drop = useTeamDropTarget(index, active ? teamTone(index).edge : 'transparent')

  return (
    // Clicking anywhere on a card makes it the target — for the names box
    // above and for the saved roster alike — so filling team three is: click
    // the card, then type or click the names.
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
