import { useState } from 'react'

import { PlayerRow } from './PlayerRow'

/** The archive, folded away under a switch below the active roster. */
export function ArchivedPlayers({ players, onRestore, onRemove }) {
  const [open, setOpen] = useState(false)

  if (players.length === 0) return null

  return (
    <div className="border-base-content/10 mt-8 border-t pt-6">
      {/* A switch rather than a button: this is a view that is on or off, and
          the count says how many names are behind it. */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="accent-primary h-4 w-4 shrink-0"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            Show archived <span className="text-base-content/50">({players.length})</span>
          </span>
          <span className="text-base-content/50 block text-xs">
            Hidden from the roster picker, with their history kept. Restore any of them to bring
            them back.
          </span>
        </span>
      </label>

      {open && (
        <ul className="mt-3 grid gap-2">
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              archived
              onRestore={() => onRestore(player.id)}
              onRemove={() => onRemove(player.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
