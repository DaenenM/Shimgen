import { useState } from 'react'

import { Check, Plus } from '@/components/icons'

// Adds rows to a table from the saved roster or a pasted list. Used by TableCard.jsx.
// Roster chips are shown first since they carry a player link a bracket can match later.
export function AddRows({ roster, existing, onAdd, onDone }) {
  const [pasted, setPasted] = useState('')

  function addPasted() {
    if (!pasted.trim()) return
    onAdd({ names: pasted.split(/[\n,]/) })
    setPasted('') // panel stays open for the next batch
  }

  const taken = new Set(existing.map((row) => row.display_name.toLowerCase()))
  const unused = roster.filter((p) => !taken.has(p.display_name.toLowerCase()))

  return (
    <div className="glass-inset space-y-3 p-3">
      {unused.length > 0 && (
        <div>
          <span className="text-base-content/60 mb-1.5 block text-xs font-semibold tracking-wide uppercase">
            Saved roster
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unused.map((player) => (
              <button
                key={player.id ?? player.display_name}
                type="button"
                onClick={() =>
                  onAdd({
                    player_ids: player.id ? [player.id] : [],
                    names: player.id ? [] : [player.display_name],
                  })
                }
                className="glass-raised hover:border-primary/50 hover:text-primary h-8 rounded-full px-3 text-sm transition-colors duration-150"
              >
                {player.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 w-full resize-none p-3 text-sm transition-colors focus:outline-none"
        rows={2}
        placeholder={'One name per line, or comma separated'}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        // No Enter-to-submit: it would break typing one name per line.
        aria-label="Add players"
      />

      <div className="flex flex-wrap gap-2">
        <button
          className="bg-primary text-primary-content hover:bg-primary/90 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
          disabled={!pasted.trim()}
          onClick={addPasted}
        >
          <Plus className="h-4 w-4" />
          Add them
        </button>

        {/* Explicit close, since adds don't close the panel automatically. */}
        <button
          className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
          onClick={onDone}
        >
          <Check className="h-4 w-4" />
          Done
        </button>
      </div>
    </div>
  )
}
