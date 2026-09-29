import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Menu, X } from '@/components/icons'

import { memberId } from '../../context/dragState'

// A draggable player row. Used by DraggableMembers.jsx.
// While dragging, this stays as a faded placeholder; LiftedMember follows the pointer.
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
        {/* Drag handle icon: hover-revealed on pointer, always visible on touch. */}
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
          // Stop propagation so this button doesn't trigger the row's drag sensors.
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={removeLabel}
          title="Remove"
          // Hover-revealed on pointer, always visible on touch.
          className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-6 w-6 shrink-0 place-items-center rounded-md transition-all duration-150 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}
