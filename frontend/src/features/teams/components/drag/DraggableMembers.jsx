import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useContext } from 'react'

import { DragState, memberId } from '../../context/dragState'
import { SortableMember } from './SortableMember'

/**
 * A team's players as draggable rows, or a place to drop one when it is empty.
 *
 * `onRemove(key)` adds a × to each row; leave it out where players cannot be
 * removed (the generator's rolled teams).
 */
export function DraggableMembers({
  index,
  keys,
  labelOf,
  onRemove,
  removeLabel = (label) => `Remove ${label}`,
  emptyText = 'No players yet',
}) {
  const { dragging, overGroup } = useContext(DragState)
  const isTarget = dragging != null && overGroup === index

  return (
    <SortableContext items={keys.map(memberId)} strategy={verticalListSortingStrategy}>
      {keys.length > 0 ? (
        <ul className="-mx-1.5 space-y-0.5">
          {keys.map((key) => (
            <SortableMember
              key={key}
              id={key}
              label={labelOf(key)}
              onRemove={onRemove ? () => onRemove(key) : null}
              removeLabel={removeLabel(labelOf(key))}
            />
          ))}
        </ul>
      ) : (
        // An empty team needs a visible place to aim at while something is in
        // the air; at rest it just says so.
        <div
          className={`grid h-9 place-items-center rounded-lg border border-dashed text-xs transition-colors duration-200 ${
            isTarget
              ? 'border-primary/60 text-primary'
              : dragging != null
                ? 'border-base-content/25 text-base-content/50'
                : 'text-base-content/35 border-transparent'
          }`}
        >
          {dragging != null ? 'Drop a player here' : emptyText}
        </div>
      )}
    </SortableContext>
  )
}
