import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { useRoster } from '@/hooks/useRoster'

/**
 * Who is playing, and the box to add more.
 *
 * The saved roster used to sit underneath this and is now its own column beside
 * the form (see SavedRoster) — inside the form it resized the container every
 * time the list wrapped, and buried the names people were about to click below
 * the box they were typing in.
 */
export function RosterPicker({ selected, onChange }) {
  // Still writes to the roster, so names used once come back next Saturday —
  // the list itself now renders beside the form as <SavedRoster />.
  const { remember } = useRoster()

  const [pasted, setPasted] = useState('')

  const chosen = new Set(selected.map((n) => n.toLowerCase()))

  function applyPaste() {
    // Split on newlines or commas — a pasted Discord list uses either.
    const names = pasted
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)

    const additions = names.filter((n) => !chosen.has(n.toLowerCase()))
    onChange([...selected, ...additions])
    remember(additions)

    setPasted('')
  }

  return (
    <div className="space-y-4">
      {/* Who is playing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            Players <span className="text-base-content/50">({selected.length})</span>
          </span>
          {selected.length > 0 && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange([])}>
              Clear all
            </button>
          )}
        </div>

        <div className="border-base-300 bg-base-200/40 focus-within:border-primary/50 flex min-h-[3.75rem] flex-wrap items-center gap-2 rounded-xl border p-3 transition-colors duration-200">
          {selected.length === 0 && (
            <span className="text-base-content/40 text-sm">
              Paste names below, or pick from the roster.
            </span>
          )}

          {selected.map((name) => (
            <span
              key={name}
              className="bg-primary text-primary-content group inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-medium shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
            >
              {name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((n) => n !== name))}
                aria-label={`Remove ${name}`}
                // Its own rounded hit area rather than a bare icon: a 12px
                // glyph is an awkward thing to hit, especially on a phone.
                className="hover:bg-primary-content/20 grid h-5 w-5 place-items-center rounded-full transition-colors duration-150"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* One way in rather than two. A single-name field beside a paste box
          was two controls doing the same job, and the paste box takes one name
          as happily as ten. */}
      <div className="space-y-2">
        <textarea
          className="textarea textarea-bordered w-full rounded-xl text-sm"
          rows={3}
          placeholder={'One name per line, or comma separated\nMark, Daniel, Jacob'}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          // Enter inserts a newline, as a textarea should. Submitting on it
          // fought the box's own purpose: typing a list one name per line
          // added the first name and cleared the rest.
          aria-label="Add players"
        />

        <button
          type="button"
          onClick={applyPaste}
          disabled={!pasted.trim()}
          className="bg-primary text-primary-content shadow-primary/20 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold shadow-lg transition-all duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
        >
          <Plus className="h-4 w-4" />
          Add them
        </button>
      </div>
    </div>
  )
}
