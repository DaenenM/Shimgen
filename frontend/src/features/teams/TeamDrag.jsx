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
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Menu, X } from '@/components/icons'
import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useMediaQuery } from '@/hooks/useMediaQuery'

import { DragState, isMember, keyOf, memberId } from './teamDragState'

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
 *       const drop = useTeamDropTarget(index)   (from ./teamDragState)
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

/**
 * A player on a team, as a plain line — one that can be picked up and carried
 * to another team.
 *
 * While it is being dragged this stays behind as a faded placeholder holding
 * the gap, and `LiftedMember` in the overlay is what follows the pointer.
 */
function SortableMember({ id, label, onRemove, removeLabel }) {
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

// How the lifted name swings. Tuned by feel, in real units so it behaves the
// same at 60Hz and 144Hz.
const MAX_TILT = 9 // degrees — approached, never hit (see `tanh` below)
const SATURATION = 1200 // px/s of sideways speed that gives ~76% of MAX_TILT
const VELOCITY_SMOOTHING = 0.07 // seconds: the window the pointer's speed is averaged over
const STIFFNESS = 170 // spring pull toward the target lean, per second²
const DAMPING = 17 // resistance — ζ ≈ 0.65: one soft overshoot, then still
const MAX_STEP = 1 / 30 // seconds: a hitch longer than this is not simulated as one leap

/**
 * The name in the air, swinging with the pointer.
 *
 * Carried like something held by its top edge: moving right drags the base
 * behind it, so the leading (right) end dips and the trailing end lifts —
 * a clockwise lean — and moving left leans it the other way. Only sideways
 * speed counts; straight up or down leaves it level.
 *
 * What makes it smooth rather than twitchy:
 *
 *  - Speed is sampled once per frame and averaged over ~70ms, not taken from
 *    each pointer event. Mice report at their own rate (125–1000Hz), out of
 *    step with the display, so per-event speeds alternate between a spike and
 *    nothing — which is exactly what read as jitter.
 *  - The spring is integrated over real elapsed time, so its feel does not
 *    change with the refresh rate or a dropped frame.
 *  - The lean eases toward its maximum (`tanh`) instead of hitting a hard cap,
 *    so a fast flick leans further without ever slamming into a limit.
 *  - Damped just under critical: it glides into a lean and settles with one
 *    soft overshoot when the pointer stops, which is what gives it weight.
 *
 * Writes `rotate` straight to the element each frame rather than through
 * React state, which would re-render the overlay sixty-plus times a second.
 * `rotate`, not `transform`: `pill-lift` animates `transform` (the lift's
 * scale), and an animation outranks an inline style on the same property —
 * the two separate properties compose instead.
 */
function LiftedMember({ label }) {
  const el = useRef(null)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    if (reducedMotion) return

    let pointerX = null
    let sampledX = null
    let velocity = 0
    let angle = 0
    let spin = 0
    let last = performance.now()
    let frame

    // Only records where the pointer is; the frame loop decides what it means.
    // pointermove covers mouse and touch alike, whichever sensor started the
    // drag.
    const onMove = (event) => {
      pointerX = event.clientX
    }

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, MAX_STEP)
      last = now

      if (dt > 0) {
        if (pointerX !== null && sampledX !== null) {
          const raw = (pointerX - sampledX) / dt
          // Exponential smoothing with a time constant, so the averaging window
          // is the same length whatever the frame rate.
          velocity += (raw - velocity) * (1 - Math.exp(-dt / VELOCITY_SMOOTHING))
        }
        sampledX = pointerX

        const target = MAX_TILT * Math.tanh(velocity / SATURATION)
        spin += (STIFFNESS * (target - angle) - DAMPING * spin) * dt
        angle += spin * dt

        if (el.current) el.current.style.rotate = `${angle.toFixed(3)}deg`
      }

      frame = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove)
    frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [reducedMotion])

  return (
    <div
      ref={el}
      // `will-change` keeps the chip on its own compositor layer for the whole
      // drag, so each frame's new angle is a cheap composite, not a repaint of
      // the blurred glass.
      className="pill-lift glass-raised cursor-grabbing rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg will-change-[rotate,transform]"
    >
      {label}
    </div>
  )
}
