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

/*
 * Dragging players between teams — one implementation for every page that
 * shows teams, so the new-tournament form and the team generator cannot drift
 * into two different feels.
 *
 * The pages keep their own team shapes (names on the form, player records in
 * the generator); this works on `groups`, a list of lists of string keys, one
 * list per team. A key must be unique across all the groups.
 *
 *   <TeamDragProvider groups={…} onChange={…} labelOf={…}>
 *     …each team card:
 *       const drop = useTeamDropTarget(index)   (from hooks/useTeamDropTarget)
 *       <DraggableMembers index={index} keys={…} labelOf={…} />
 *   </TeamDragProvider>
 */

/**
 * Which droppable the pointer is over.
 *
 * The pointer itself rather than the dragged row's overlap: rows are small, so
 * "most overlap" flickers between neighbours while "under the cursor" is what
 * the person is actually aiming at. A row wins over the team card behind it,
 * so dropping onto a name inserts beside it. The keyboard has no pointer, so
 * it falls back to nearest-centre.
 */
function collisions(args) {
  if (!args.pointerCoordinates) return closestCenter(args)

  const hits = pointerWithin(args)
  if (hits.length === 0) return rectIntersection(args)

  return [hits.find((hit) => isMember(hit.id)) ?? hits[0]]
}

/**
 * The drag context for a set of teams, with the lifted name in the air.
 *
 * `onDropped(index)` is told which team a player ended up in, for a page that
 * wants to follow the move (the form makes that team its target).
 */
export function TeamDragProvider({ groups, onChange, labelOf, onDropped, children }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // The key being dragged, and the team the pointer is over — the second
  // drives the drop-target highlight, including for a team that is empty.
  const [dragging, setDragging] = useState(null)
  const [overGroup, setOverGroup] = useState(null)

  // Drag events fire between renders, so they read the latest groups through a
  // ref rather than whatever their closure captured. `snapshot` is the layout
  // at pick-up, restored if the drag is cancelled.
  const latest = useRef(groups)
  const snapshot = useRef(null)
  useEffect(() => {
    latest.current = groups
  }, [groups])

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking a row's × or
    // the card itself still reads as a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Press and hold on touch. An immediate drag would hijack every swipe that
    // happened to start on a row, and the list has to scroll.
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

  /**
   * Move the row into another team the moment it crosses over.
   *
   * Done live rather than on drop so the destination opens a gap for it and
   * the source closes up behind it while the name is still in the air — the
   * drop then only has to settle it, which is what makes the move feel direct.
   * Reordering within one team is left to the sortable transforms until drop.
   */
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
        // Rows change team mid-drag, so the cards' sizes change with them;
        // measuring continuously keeps the drop targets where they now are.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {children}

        {/* Portalled to <body>. The overlay is `position: fixed`, and the teams
            sit inside glass panels, whose `backdrop-filter` makes each one the
            containing block for fixed descendants — so rendered in place, the
            lifted name was positioned relative to the panel and drifted away
            from the cursor by the panel's offset on the page. */}
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
