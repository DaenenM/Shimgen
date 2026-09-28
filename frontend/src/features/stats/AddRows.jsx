import { Check, Plus } from '@/components/icons'
import { useState } from 'react'

/**
 * Add competitors, from the saved roster or pasted.
 *
 * A roster name comes with its player link, which is what lets a finished
 * tournament find this row later — so those chips are offered first.
 */
export function AddRows({ roster, existing, onAdd, onDone }) {
  const [pasted, setPasted] = useState('')

  function addPasted() {
    if (!pasted.trim()) return
    onAdd({ names: pasted.split(/[\n,]/) })
    // Cleared so the next batch starts empty — the panel stays open, and
    // leaving the names in it would re-add them on the following click.
    setPasted('')
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
        // Enter inserts a newline, as a textarea should. Submitting on it
        // fought the box's own purpose: typing a list one name per line added
        // the first name and cleared the rest.
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

        {/* The panel closes here rather than after each add, so a run of
            players is one visit instead of one visit per name. */}
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
