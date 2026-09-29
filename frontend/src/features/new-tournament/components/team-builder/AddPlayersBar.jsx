import { useState } from 'react'

import { Plus } from '@/components/icons'
import { Select } from '@/components/ui/Select'
import { teamTone } from '@/features/teams/utils/tone'

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
export function AddPlayersBar({ teams, target, assigned, onTarget, onAdd }) {
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
