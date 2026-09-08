import { Check, Plus, Users, X } from 'lucide-react'

import { useRoster } from '@/hooks/useRoster'

/**
 * The saved roster, as a column beside the form rather than inside it.
 *
 * It lived in the form until now, which made the form resize every time the
 * list wrapped onto another line — and put the names people are about to click
 * below the box they are typing into. As its own column it holds still, stays
 * in view while the form scrolls, and reads as what it is: a list of people to
 * pick from.
 *
 * A list rather than pills, because a column is tall and narrow: pills waste a
 * vertical strip on whitespace, while one name per row scans top to bottom the
 * way a roster actually gets read.
 */
export function SavedRoster({ selected, onAdd, title = 'Saved roster' }) {
  const { players, forget, isLoading } = useRoster()

  const chosen = new Set(selected.map((n) => n.toLowerCase()))

  if (isLoading) {
    return (
      <aside className="card bg-base-100 border-base-300 self-start border">
        <div className="card-body gap-2 p-4">
          <span className="loading loading-spinner loading-sm self-center" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="card bg-base-100 border-base-300 self-start border lg:sticky lg:top-20">
      <div className="card-body gap-3 p-4">
        <div>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4" />
            {title}
          </span>
          <p className="text-base-content/50 mt-0.5 text-xs">
            {players.length === 0
              ? 'Names you use are remembered here.'
              : 'Click a name to add them.'}
          </p>
        </div>

        {players.length === 0 ? (
          <p className="text-base-content/40 py-4 text-center text-sm">
            Nobody saved yet — the names you add will show up here next time.
          </p>
        ) : (
          // Capped and scrolling, so a roster of forty does not push the page
          // to twice the height of the form beside it.
          <ul className="-mx-1 max-h-[26rem] space-y-0.5 overflow-y-auto px-1">
            {players.map((player) => {
              const added = chosen.has(player.display_name.toLowerCase())

              return (
                <li key={player.id ?? player.display_name} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => !added && onAdd(player.display_name)}
                    disabled={added}
                    // Already-added names stay visible rather than vanishing:
                    // a list that reorders itself as you click is hard to work
                    // down, and seeing the tick is the confirmation.
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
                      added
                        ? 'text-base-content/35 cursor-default'
                        : 'hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {added ? (
                      <Check className="text-success h-3.5 w-3.5 shrink-0" />
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
                    className="text-base-content/30 hover:text-error hover:bg-error/10 mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
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
