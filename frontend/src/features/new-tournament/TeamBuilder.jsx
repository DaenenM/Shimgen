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
  useDroppable,
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
import { ChevronDown, Menu, Plus, Trash2, X } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Select } from '@/components/ui/Select'
import { TeamCardShell } from '@/features/teams/TeamCardShell'
import { teamTone } from '@/features/teams/tone'
import { useAutoSaveRoster } from '@/hooks/useAutoSaveRoster'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useRoster } from '@/hooks/useRoster'

// Draggable ids carry their kind, so one handler can tell a player from the
// team card it was dropped on. Names are unique across the whole form (see
// `assigned` below), so a name is a stable id on its own.
const memberId = (name) => `m:${name}`
const teamId = (index) => `team:${index}`
const nameOf = (id) => String(id).slice(2)
const isMember = (id) => String(id).startsWith('m:')

/**
 * Which droppable the pointer is over.
 *
 * The pointer itself rather than the dragged pill's overlap: pills are small
 * and wrap, so "most overlap" flickers between neighbours while "under the
 * cursor" is what the person is actually aiming at. A pill wins over the team
 * card behind it, so dropping onto a name inserts beside it. The keyboard has
 * no pointer, so it falls back to nearest-centre.
 */
function collisions(args) {
  if (!args.pointerCoordinates) return closestCenter(args)

  const hits = pointerWithin(args)
  if (hits.length === 0) return rectIntersection(args)

  return [hits.find((hit) => isMember(hit.id)) ?? hits[0]]
}

/**
 * Build teams by hand, rather than randomising them.
 *
 * The team generator answers "split these ten people fairly". This answers the
 * other half: the teams already exist — the same pairs turn up every Saturday —
 * and the host just needs to write them down. Players can be dragged between
 * teams (and reordered within one) when somebody lands on the wrong side.
 *
 * Each team is `{ label, members }`, which is exactly the `entrant_teams` shape
 * the API takes, so nothing has to be translated on submit.
 *
 * The saved roster lives beside the form as its own column, and `activeTeam`
 * says which card its clicks land in.
 */
export function TeamBuilder({
  teams,
  onChange,
  activeTeam = 0,
  onFocusTeam = () => {},
  expanded = false,
  onExpandedChange = () => {},
}) {
  const { remember } = useRoster()
  const [autoSave] = useAutoSaveRoster()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // The name being dragged, and the team the pointer is over — the second
  // drives the drop-target highlight, including for a team that is empty.
  const [dragging, setDragging] = useState(null)
  const [overTeam, setOverTeam] = useState(null)

  // Drag events fire between renders, so they read the latest teams through a
  // ref rather than whatever their closure captured. `snapshot` is the layout
  // at pick-up, restored if the drag is cancelled.
  const latest = useRef(teams)
  const snapshot = useRef(null)
  useEffect(() => {
    latest.current = teams
  }, [teams])

  // Whether the capped list has more than it can show — the expand toggle is
  // only worth a row when there is something hidden behind it. Measured by a
  // ResizeObserver on the list *and* its children: the list's own box does not
  // change size when a team is added to it (it is capped), its content does.
  const root = useRef(null)
  const list = useRef(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = list.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1)
    })
    observer.observe(el)
    for (const child of el.children) observer.observe(child)

    return () => observer.disconnect()
  }, [teams.length, expanded])

  /**
   * Open the list out onto the page, or fold it back.
   *
   * Collapsing after scrolling down through a long list would otherwise leave
   * the reader looking at whatever moved up into the space — so the heading is
   * brought back into view, but only if it has gone off the top.
   */
  function toggleExpanded() {
    const next = !expanded
    onExpandedChange(next)

    if (!next && root.current && root.current.getBoundingClientRect().top < 0) {
      root.current.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking a pill's × or
    // the card itself still reads as a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Press and hold on touch. An immediate drag would hijack every swipe that
    // happened to start on a pill, and the list has to scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const update = (index, patch) =>
    onChange(teams.map((team, i) => (i === index ? { ...team, ...patch } : team)))

  // Where typed names go. Clamped, because deleting the last team would
  // otherwise leave the target pointing past the end of the list.
  const target = Math.min(activeTeam, teams.length - 1)

  const addTeam = () => onChange([...teams, { label: '', members: [] }])
  const removeTeam = (index) => {
    onChange(teams.filter((_, i) => i !== index))
    // Keep the target on a team that still exists, and on the same team when
    // one above it was removed, so the saved roster never fills a ghost.
    if (index < activeTeam || activeTeam >= teams.length - 1) {
      onFocusTeam(Math.max(0, activeTeam - 1))
    }
  }

  // Everyone already placed on any team. Nobody can play for two sides at
  // once, so a name taken elsewhere is neither suggested again nor accepted if
  // typed — computed across the whole tournament rather than per card.
  const assigned = new Set(teams.flatMap((team) => team.members.map((name) => name.toLowerCase())))

  const teamOf = (id, current = latest.current) => {
    if (!id) return null
    if (!isMember(id)) return Number(String(id).slice(5))
    const name = nameOf(id)
    const index = current.findIndex((team) => team.members.includes(name))
    return index === -1 ? null : index
  }

  function onDragStart({ active }) {
    snapshot.current = latest.current
    setDragging(nameOf(active.id))
    setOverTeam(teamOf(active.id))
  }

  /**
   * Move the pill into another team the moment it crosses over.
   *
   * Done live rather than on drop so the destination opens a gap for it and
   * the source closes up behind it while the pill is still in the air — the
   * drop then only has to settle it, which is what makes the move feel direct.
   * Reordering within one team is left to the sortable transforms until drop.
   */
  function onDragOver({ active, over }) {
    const to = teamOf(over?.id)
    setOverTeam(to)

    const from = teamOf(active.id)
    if (from == null || to == null || from === to) return

    const name = nameOf(active.id)
    const current = latest.current
    const target = current[to].members
    // Dropped on a pill: take its place. On the card itself: join the end.
    const at = isMember(over.id) ? target.indexOf(nameOf(over.id)) : target.length

    const next = current.map((team, index) => {
      if (index === from) return { ...team, members: team.members.filter((m) => m !== name) }
      if (index === to) {
        const members = [...team.members]
        members.splice(at === -1 ? members.length : at, 0, name)
        return { ...team, members }
      }
      return team
    })

    latest.current = next
    onChange(next)
  }

  function onDragEnd({ active, over }) {
    const current = latest.current
    const from = teamOf(active.id)

    if (over && isMember(over.id) && from != null && from === teamOf(over.id)) {
      const members = current[from].members
      const oldIndex = members.indexOf(nameOf(active.id))
      const newIndex = members.indexOf(nameOf(over.id))

      if (oldIndex !== newIndex) {
        onChange(
          current.map((team, index) =>
            index === from ? { ...team, members: arrayMove(members, oldIndex, newIndex) } : team,
          ),
        )
      }
    }

    // The team a player was dropped into is the one being worked on now.
    if (from != null) onFocusTeam(from)
    finish()
  }

  function onDragCancel() {
    if (snapshot.current) onChange(snapshot.current)
    finish()
  }

  function finish() {
    snapshot.current = null
    setDragging(null)
    setOverTeam(null)
  }

  return (
    // A column that fills whatever height it is given, so the list between the
    // header and the add button is the only part that scrolls — both stay put
    // and reachable no matter how many teams there are.
    <div ref={root} className="@container flex min-h-0 scroll-mt-20 flex-col gap-3">
      <div className="flex shrink-0 items-baseline justify-between">
        <span className="text-sm font-medium">
          Teams <span className="text-base-content/50">({teams.length})</span>
        </span>
        {teams.length > 0 && (
          <button
            type="button"
            className="text-base-content/50 hover:text-base-content text-xs transition-colors"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
      </div>

      {teams.length > 0 && (
        <AddPlayersBar
          teams={teams}
          target={target}
          assigned={assigned}
          onTarget={onFocusTeam}
          onAdd={(names) => {
            update(target, { members: [...teams[target].members, ...names] })
            // Typed names go to the roster too, unless that is switched off
            // from the saved roster's header.
            if (autoSave) remember(names)
          }}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisions}
        // Pills change team mid-drag, so the cards' sizes change with them;
        // measuring continuously keeps the drop targets where they now are.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {/* Two across once the column is wide enough (28rem), one below it.
            A container query rather than a breakpoint: what matters is the
            width of this column, not the screen — two across in a narrow
            column truncated every team name to "Tea…".

            The padding is for the outlines: this list scrolls, so it clips, and
            the active card's ring sits 2px outside the card. The negative
            margins cancel it, so the cards still line up with the heading above
            and the "Add a team" button below.

            On the right the list reaches out through the form panel's own
            1.25rem padding, so the scrollbar runs down the panel's edge rather
            than floating in the middle of the form. `pr-3` plus a thin
            scrollbar (~8px) gives back almost exactly that 1.25rem, and the
            stable gutter keeps the cards the same width whether the list is
            long enough to scroll or not.

            Expanded, none of that applies: the page scrolls instead, so the
            list is just a column of cards with room for their outlines. */}
        <ul
          ref={list}
          className={`-my-1 -ml-1 grid min-h-0 flex-1 grid-cols-1 content-start items-start gap-3 py-1 pl-1 @md:grid-cols-2 ${
            expanded
              ? '-mr-1 pr-1'
              : '-mr-5 [scrollbar-width:thin] [scrollbar-gutter:stable] overflow-y-auto pr-3'
          }`}
        >
          {teams.map((team, index) => (
            <TeamCard
              key={index}
              team={team}
              index={index}
              active={index === target}
              dropTarget={dragging != null && overTeam === index}
              dragging={dragging != null}
              onFocus={() => onFocusTeam(index)}
              onUpdate={(patch) => update(index, patch)}
              onRemove={() => removeTeam(index)}
            />
          ))}
        </ul>

        {/* Portalled to <body>. The overlay is `position: fixed`, and this list
            sits inside `.glass-panel`, whose `backdrop-filter` makes it the
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
            {dragging ? <LiftedPlayer name={dragging} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>

      <button
        type="button"
        onClick={addTeam}
        className="border-base-content/15 text-base-content/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium transition-colors duration-150"
      >
        <Plus className="h-4 w-4" />
        Add a team
      </button>

      {(overflowing || expanded) && (
        // A chevron that points the way it will move the list: down to open it
        // out onto the page, up to fold it back into its scroll box.
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse the team list' : 'Show all teams'}
          title={expanded ? 'Collapse' : 'Show all teams'}
          className="text-base-content/50 hover:text-base-content hover:bg-base-content/8 mx-auto -mt-1 grid h-8 w-12 shrink-0 place-items-center rounded-full transition-colors duration-150"
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ease-out ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {teams.length === 1 && (
        <p className="text-base-content/50 text-center text-xs">
          A tournament needs at least two teams.
        </p>
      )}
    </div>
  )
}

function TeamCard({ team, index, active, dropTarget, dragging, onFocus, onUpdate, onRemove }) {
  const tone = teamTone(index)

  // The whole card accepts a drop, not only its rows — otherwise an empty team
  // could never receive anyone.
  const { setNodeRef } = useDroppable({ id: teamId(index) })

  const removeMember = (name) => onUpdate({ members: team.members.filter((m) => m !== name) })

  return (
    // Clicking anywhere on a card makes it the target — for the names box
    // above and for the saved roster alike — so filling team three is: click
    // the card, then type or click the names.
    // The chosen card is outlined in its own colour; a card being dragged over
    // is outlined in the interactive blue, which wins while a drag is live.
    <TeamCardShell
      as="li"
      innerRef={setNodeRef}
      onClick={onFocus}
      index={index}
      name={team.label}
      onRename={(label) => onUpdate({ label })}
      count={team.members.length}
      surface="glass-inset"
      // `shrink-0` is load-bearing. The list is a height-capped flex column, and
      // flex items shrink by default — so once the teams outgrew it, every card
      // was squashed instead of the list scrolling, and the card's own
      // `overflow-hidden` cut off its last players.
      className={`shrink-0 cursor-pointer outline-offset-2 transition-[outline-color,background-color] duration-200 ease-out ${
        dropTarget ? 'bg-primary/8' : ''
      }`}
      style={{
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineColor: dropTarget ? 'var(--color-primary)' : active ? tone.edge : 'transparent',
      }}
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
      <SortableContext items={team.members.map(memberId)} strategy={verticalListSortingStrategy}>
        {team.members.length > 0 ? (
          <ul className="-mx-1.5 space-y-0.5">
            {team.members.map((name) => (
              <SortablePlayer
                key={name}
                name={name}
                onRemove={() => removeMember(name)}
                removeLabel={`Remove ${name} from team ${index + 1}`}
              />
            ))}
          </ul>
        ) : (
          // An empty team needs a visible place to aim at while something is
          // in the air; at rest it just says so.
          <div
            className={`grid h-9 place-items-center rounded-lg border border-dashed text-xs transition-colors duration-200 ${
              dropTarget
                ? 'border-primary/60 text-primary'
                : dragging
                  ? 'border-base-content/25 text-base-content/50'
                  : 'text-base-content/35 border-transparent'
            }`}
          >
            {dragging ? 'Drop a player here' : 'No players yet'}
          </div>
        )}
      </SortableContext>
    </TeamCardShell>
  )
}

/**
 * One names box for every team, and where its names go.
 *
 * A box per card put eight identical inputs on the page and spent a row of
 * every card on a control only one of them was ever using. Here there is one,
 * and the target is chosen either from the dropdown or by clicking a card —
 * both set the same `activeTeam`, so the two can never disagree, and it is the
 * same target the saved roster column fills.
 *
 * Enter adds what is typed; Shift+Enter starts a new line for anyone building
 * a list by hand, and a pasted list (lines or commas) goes in whole. Anyone
 * already on a team is skipped and named, rather than the whole batch being
 * refused — a list of five where one is a duplicate should add the other four.
 */
function AddPlayersBar({ teams, target, assigned, onTarget, onAdd }) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState(null)
  const teamName = (index) => teams[index].label.trim() || `Team ${index + 1}`

  function submit() {
    const names = draft
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length === 0) return

    const added = []
    const skipped = []
    const seen = new Set(assigned)

    for (const name of names) {
      const key = name.toLowerCase()
      if (seen.has(key)) {
        skipped.push(name)
        continue
      }
      seen.add(key)
      added.push(name)
    }

    if (added.length > 0) onAdd(added)

    setDraft(skipped.length > 0 && added.length === 0 ? draft : '')
    setError(
      skipped.length > 0
        ? `${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} already on a team.`
        : null,
    )
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {/* One row: what to add, where it goes, and the button that does it.
          All three are 40px at rest — the textarea's 9px padding plus a 20px
          line and its border come to exactly that, matching the dropdown's
          `lg` size and the button. The side controls are held at that height and
          top-aligned, so when a pasted list grows the box downward they stay
          level with its first line instead of drifting to its middle. */}
      <div className="flex items-start gap-2">
        <textarea
          className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 min-h-0 min-w-0 flex-1 resize-none px-3 py-[9px] text-sm transition-all duration-150 focus:outline-none"
          rows={
            draft.includes('\n') || focused ? Math.min(4, Math.max(1, draft.split('\n').length)) : 1
          }
          placeholder="Add names…"
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          aria-label={`Add players to ${teamName(target)}`}
        />

        <div className="flex h-10 shrink-0 items-center gap-2 text-xs">
          {/* Each team carries its colour as a swatch, in the list and on the
              trigger, so the dropdown and the outlined card below read as the
              same thing. */}
          <Select
            label="Team to add players to"
            value={target}
            onChange={onTarget}
            options={teams.map((_, index) => ({
              value: index,
              label: teamName(index),
              dot: teamTone(index).edge,
            }))}
            size="lg"
            className="w-36"
            triggerClassName="font-semibold"
          />

          {/* The one piece that can go when the row is tight: clicking a card
              is discoverable anyway, since the chosen one is outlined. */}
          <span className="text-base-content/35 hidden whitespace-nowrap @xl:inline">
            or click a team
          </span>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="bg-primary text-primary-content hover:bg-primary/90 grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Add to ${teamName(target)}`}
          title={`Add to ${teamName(target)}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  )
}

/**
 * A player on a team, as a plain line like the generator's — but one that can
 * be picked up and carried to another team.
 *
 * While it is being dragged this stays behind as a faded placeholder holding
 * the gap, and `LiftedPlayer` in the overlay is what follows the pointer.
 */
function SortablePlayer({ name, onRemove, removeLabel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: memberId(name),
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
      aria-label={`${name} — press space to move to another team`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {/* The drag affordance, shown on hover — and always on touch, where
            there is no hover to reveal it. Its space is kept at rest so the
            name does not shift sideways when it appears. */}
        <Menu
          className="text-base-content/40 h-3.5 w-3.5 shrink-0 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100"
          aria-hidden="true"
        />
        <span className="truncate">{name}</span>
      </span>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
        // The × sits inside the drag handle, so the events the sensors listen
        // for are stopped here: otherwise a press on it could start a drag, and
        // Enter on a focused × would pick the row up instead of removing it.
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
function LiftedPlayer({ name }) {
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
      {name}
    </div>
  )
}
