import { Check, Plus, Users, X } from '@/components/icons'

import { useRoster } from '@/hooks/useRoster'

export function SavedRoster({ selected, onAdd, onRemove, title = 'Saved roster' }) {
  const { players, forget, isLoading } = useRoster()

  const chosen = new Set(selected.map((n) => n.toLowerCase()))

  if (isLoading) {
    return (
      <aside className="card bg-base-100 border-base-300 self-start border">
        <div className="card-body gap-2 p-3">
          <span className="loading loading-spinner loading-sm self-center" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="card bg-base-100 border-base-300 self-start border lg:sticky lg:top-20">
      <div className="card-body gap-3 p-3">
        <div>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4" />
            {title}
          </span>
          <p className="text-base-content/50 mt-0.5 text-xs">
            {players.length === 0
              ? 'Names you use are remembered here.'
              : 'Click a name to add or remove them.'}
          </p>
        </div>

        {players.length === 0 ? (
          <p className="text-base-content/40 py-4 text-center text-sm">
            Nobody saved yet. The names you add will show up here next time.
          </p>
        ) : (
          <ul className="max-h-[26rem] space-y-0.5 overflow-y-auto">
            {players.map((player) => {
              const added = chosen.has(player.display_name.toLowerCase())

              return (
                <li key={player.id ?? player.display_name} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      added ? onRemove(player.display_name) : onAdd(player.display_name)
                    }
                    // Toggles rather than disabling: clicking an added name
                    // now removes it, which is what lets a mis-click here be
                    // undone the same way it was added, instead of forcing a
                    // trip to the players box to remove it there.
                    aria-pressed={added}
                    title={added ? `Remove ${player.display_name}` : `Add ${player.display_name}`}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 ${
                      added
                        ? 'text-success hover:bg-error/10 hover:text-error'
                        : 'hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {added ? (
                      <Check className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:scale-0" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    )}
                    <span className="truncate font-medium">{player.display_name}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => forget(player)}
                    aria-label={`Remove ${player.display_name} from saved roster`}
                    title="Remove from saved roster"
                    className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}