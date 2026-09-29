import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Menu, X } from '@/components/icons'

import { memberId } from '../../context/dragState'

/**
 * A player on a team, as a plain line — one that can be picked up and carried
 * to another team.
 *
 * While it is being dragged this stays behind as a faded placeholder holding
 * the gap, and `LiftedMember` in the overlay is what follows the pointer.
 */
export function SortableMember({ id, label, onRemove, removeLabel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: memberId(id),
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group hover:bg-base-content/6 flex cursor-grab touch-manipulation items-center justify-between gap-2 rounded-md py-1 pr-0.5 pl-1.5 text-sm select-none ${
        isDragging ? 'opacity-35' : ''
      }`}
      {...attributes}
      {...listeners}
      aria-label={`${label} — press space to move to another team`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {/* The drag affordance, shown on hover — and always on touch, where
            there is no hover to reveal it. Its space is kept at rest so the
            name does not shift sideways when it appears. */}
        <Menu
          className="text-base-content/40 h-3.5 w-3.5 shrink-0 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100"
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </span>

      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          // The × sits inside the drag handle, so the events the sensors listen
          // for are stopped here: otherwise a press on it could start a drag,
          // and Enter on a focused × would pick the row up instead of removing
          // it.
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={removeLabel}
          title="Remove"
          // Shown on hover where there is hover; always there on touch, where
          // there is not.
          className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-6 w-6 shrink-0 place-items-center rounded-md transition-all duration-150 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}
