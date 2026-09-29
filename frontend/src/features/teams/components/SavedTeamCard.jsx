import { Pencil, Trash2 } from '@/components/icons'
import { TeamCrest } from '@/components/ui/TeamCrest'

/** A saved team at rest: crest, name, members, and edit/delete. */
export function SavedTeamCard({ team, disabled, onEdit, onDelete }) {
  return (
    <li className="glass-inset group flex items-center gap-3 p-3">
      <TeamCrest team={team} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{team.name}</p>
        <p className="text-base-content/50 truncate text-xs">
          {team.members.length === 0
            ? 'Nobody on this team yet'
            : team.members.map((m) => m.display_name).join(', ')}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          aria-label={`Edit ${team.name}`}
          title="Edit"
          className="text-base-content/35 hover:text-primary hover:bg-primary/10 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={`Delete ${team.name}`}
          title="Delete"
          className="text-base-content/35 hover:text-error hover:bg-error/10 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}
