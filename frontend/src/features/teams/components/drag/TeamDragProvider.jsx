import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useMediaQuery } from '@/hooks/useMediaQuery'

import { DragState, isMember, keyOf } from '../../context/dragState'
import { LiftedMember } from './LiftedMember'

// Shared drag-and-drop implementation for moving players between teams.
// Used by GeneratedTeams.jsx (team generator) and TeamBuilder.jsx (new-tournament).
// Operates on `groups`: a list of lists of string keys, one list per team, keys unique across groups.
//
//   <TeamDragProvider groups={…} onChange={…} labelOf={…}>
//     …each team card: const drop = useTeamDropTarget(index); <DraggableMembers index={index} keys={…} labelOf={…} />
//   </TeamDragProvider>

// Picks the droppable under the pointer (not most-overlap, since rows are small).
// A row wins over its team card so dropping on a name inserts beside it. Keyboard falls back to nearest-centre.
function collisions(args) {
  if (!args.pointerCoordinates) return closestCenter(args)

  const hits = pointerWithin(args)
  if (hits.length === 0) return rectIntersection(args)

  return [hits.find((hit) => isMember(hit.id)) ?? hits[0]]
}

// Drag context for a set of teams; renders the lifted name in a DragOverlay.
// onDropped(index) reports which team a player ended up in (e.g. to set the form's active team).
export function TeamDragProvider({ groups, onChange, labelOf, onDropped, children }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // Key being dragged, and the team the pointer is over (drives drop-target highlight).
  const [dragging, setDragging] = useState(null)
  const [overGroup, setOverGroup] = useState(null)

  // Ref avoids stale closures in drag event handlers. `snapshot` restores layout on cancel.
  const latest = useRef(groups)
  const snapshot = useRef(null)
  useEffect(() => {
    latest.current = groups
  }, [groups])

  const sensors = useSensors(
    // Small travel threshold so a plain click still registers as a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Press-and-hold on touch so scrolling isn't hijacked as a drag.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const groupOf = (id, current = latest.current) => {
    if (!id) return null
    if (!isMember(id)) return Number(String(id).slice(5))
    const index = current.findIndex((keys) => keys.includes(keyOf(id)))
    return index === -1 ? null : index
  }

  function onDragStart({ active }) {
    snapshot.current = latest.current
    setDragging(keyOf(active.id))
    setOverGroup(groupOf(active.id))
  }

  // Moves the row into the new team live (on crossing over), not on drop, so the move feels
  // direct. Reordering within one team is left to sortable transforms until drop.
  function onDragOver({ active, over }) {
    const to = groupOf(over?.id)
    setOverGroup(to)

    const from = groupOf(active.id)
    if (from == null || to == null || from === to) return

    const key = keyOf(active.id)
    const current = latest.current
    const target = current[to]
    // Dropped on a row: take its place. On the card itself: join the end.
    const at = isMember(over.id) ? target.indexOf(keyOf(over.id)) : target.length

    const next = current.map((keys, index) => {
      if (index === from) return keys.filter((k) => k !== key)
      if (index === to) {
        const moved = [...keys]
        moved.splice(at === -1 ? moved.length : at, 0, key)
        return moved
      }
      return keys
    })

    latest.current = next
    onChange(next)
  }

  function onDragEnd({ active, over }) {
    const current = latest.current
    const from = groupOf(active.id)

    if (over && isMember(over.id) && from != null && from === groupOf(over.id)) {
      const keys = current[from]
      const oldIndex = keys.indexOf(keyOf(active.id))
      const newIndex = keys.indexOf(keyOf(over.id))

      if (oldIndex !== newIndex) {
        onChange(
          current.map((group, index) =>
            index === from ? arrayMove(group, oldIndex, newIndex) : group,
          ),
        )
      }
    }

    if (from != null) onDropped?.(from)
    finish()
  }

  function onDragCancel() {
    if (snapshot.current) onChange(snapshot.current)
    finish()
  }

  function finish() {
    snapshot.current = null
    setDragging(null)
    setOverGroup(null)
  }

  return (
    <DragState.Provider value={{ dragging, overGroup }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisions}
        // Continuous measuring since card sizes change mid-drag as rows move between teams.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {children}

        {/* Portalled to <body>: glass panels' backdrop-filter makes them containing
            blocks for fixed descendants, which would offset the overlay from the cursor. */}
        {createPortal(
          <DragOverlay
            dropAnimation={
              reducedMotion
                ? null
                : {
                    duration: 220,
                    easing: 'cubic-bezier(0.2, 0, 0, 1)',
                    sideEffects: defaultDropAnimationSideEffects({
                      styles: { active: { opacity: '0.35' } },
                      className: { dragOverlay: 'pill-drop' },
                    }),
                  }
            }
          >
            {dragging != null ? <LiftedMember label={labelOf(dragging)} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </DragState.Provider>
  )
}
