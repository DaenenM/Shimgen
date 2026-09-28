import { ChevronDown, Plus, Trash2 } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

import { Select } from '@/components/ui/Select'
import { DraggableMembers, TeamDragProvider } from '@/features/teams/TeamDrag'
import { useTeamDropTarget } from '@/features/teams/teamDragState'
import { TeamCardShell } from '@/features/teams/TeamCardShell'
import { teamTone } from '@/features/teams/tone'
import { useAutoSaveRoster } from '@/hooks/useAutoSaveRoster'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useRoster } from '@/hooks/useRoster'

/**
 * Build teams by hand, rather than randomising them.
 *
 * The team generator answers "split these ten people fairly". This answers the
 * other half: the teams already exist — the same pairs turn up every Saturday —
 * and the host just needs to write them down. Players can be dragged between
 * teams (and reordered within one) when somebody lands on the wrong side; the
 * dragging itself is `TeamDrag`, shared with the generator.
 *
 * Each team is `{ label, members }`, which is exactly the `entrant_teams` shape
 * the API takes, so nothing has to be translated on submit. Names are unique
 * across the whole form (see `assigned`), so a name is its own drag key.
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

      <TeamDragProvider
        groups={teams.map((team) => team.members)}
        onChange={(groups) =>
          onChange(teams.map((team, index) => ({ ...team, members: groups[index] })))
        }
        labelOf={(name) => name}
        // The team a player was dropped into is the one being worked on now.
        onDropped={onFocusTeam}
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
              onFocus={() => onFocusTeam(index)}
              onUpdate={(patch) => update(index, patch)}
              onRemove={() => removeTeam(index)}
            />
          ))}
        </ul>
      </TeamDragProvider>

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

function TeamCard({ team, index, active, onFocus, onUpdate, onRemove }) {
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
      // `shrink-0` is load-bearing. The list is a height-capped flex column, and
      // flex items shrink by default — so once the teams outgrew it, every card
      // was squashed instead of the list scrolling, and the card's own
      // `overflow-hidden` cut off its last players.
      className={`shrink-0 cursor-pointer ${drop.highlight.className}`}
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
          level with its first line instead of drifting to its middle.

          Under 24rem of column (a phone) the row wraps: the names box takes a
          line of its own and the team picker stretches under it. Kept on one
          line, the fixed-width picker left the box too narrow to type in. */}
      <div className="flex flex-wrap items-start gap-2 @sm:flex-nowrap">
        <textarea
          className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 min-h-0 w-full min-w-0 resize-none px-3 py-[9px] text-sm transition-all duration-150 focus:outline-none @sm:w-auto @sm:flex-1"
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

        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 text-xs @sm:flex-none @sm:shrink-0">
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
            className="w-full @sm:w-36"
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
