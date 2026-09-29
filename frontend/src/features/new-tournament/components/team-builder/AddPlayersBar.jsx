import { useState } from 'react'

import { Plus } from '@/components/icons'
import { Select } from '@/components/ui/Select'
import { teamTone } from '@/features/teams/utils/tone'

// One shared names box for all teams, plus the target-team picker. Used by TeamBuilder.jsx.
// Target is set by dropdown or by clicking a card (both set the same `activeTeam`).
// Enter submits, Shift+Enter newlines, pasted lists (lines/commas) go in whole.
// Names already on a team are skipped and named in an error, not blocking the rest of the batch.
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
      {/* All controls are 40px tall at rest to align with the textarea's first line.
          Wraps under ~24rem (phone): names box gets its own line, picker stretches below. */}
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
          {/* Colour swatch matches each team's card outline below. */}
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

          {/* Hidden first when the row is tight -- clicking a card is discoverable via its outline. */}
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
