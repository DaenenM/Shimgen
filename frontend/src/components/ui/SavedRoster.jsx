import { Check, Plus, Trash2, Users, X } from '@/components/icons'

import { useRoster } from '@/hooks/useRoster'

/**
 * `glass` is opt-in rather than the default: the Team Generator is the only
 * page trialling the glass treatment, and the flat card is still correct
 * everywhere else until that look is signed off.
 *
 * `maxHeight` caps the card, scrolling the list past that point while still
 * shrinking to fit a short roster — so four saved names give a small card, not
 * a tall empty one. Callers pass the measured height of a sibling (see
 * `useElementHeight`); CSS alone cannot express "as tall as my sibling, but no
 * taller than my content", because in a grid the row's height is derived from
 * the items in it, which makes the constraint circular.
 */
export function SavedRoster({
  selected,
  onAdd,
  onRemove,
  title = 'Saved roster',
  glass = false,
  maxHeight = null,
}) {
  const surface = glass ? 'glass-panel' : 'card bg-base-100 border-base-300 border'

  // `self-start` keeps the card shrink-wrapped to its contents. The cap is a
  // max-height rather than a height, so a short roster stays short.
  const sizing = maxHeight ? 'self-start overflow-hidden' : 'self-start lg:sticky lg:top-20'
  const capStyle = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined

  const { players, forget, isLoading } = useRoster()

  const chosen = new Set(selected.map((n) => n.toLowerCase()))

  if (isLoading) {
    return (
      <aside className={`${surface} ${sizing}`} style={capStyle}>
        <div className="flex flex-col gap-2 p-3">
          <span className="loading loading-spinner loading-sm self-center" />
        </div>
      </aside>
    )
  }

  return (
    <aside className={`${surface} ${sizing} flex flex-col`} style={capStyle}>
      <div className="flex min-h-0 flex-col gap-3 py-3">
        <div className="px-3">
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
          <p className="text-base-content/40 px-3 py-4 text-center text-sm">
            Nobody saved yet. The names you add will show up here next time.
          </p>
        ) : (
          <ul
            className={`space-y-0.5 overflow-y-auto pr-1 pl-3 ${maxHeight ? 'min-h-0' : 'max-h-[26rem]'}`}
          >
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
                      // Tick at rest, cross on hover — both in one slot so the
                      // row does not reflow as they swap. The tick says "in";
                      // the cross says what the click about to happen does.
                      <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
                        <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
                        <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                      </span>
                    ) : (
                      <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    )}
                    <span className="truncate font-medium">{player.display_name}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => forget(player)}
                    aria-label={`Delete ${player.display_name} from saved roster`}
                    title="Delete from saved roster"
                    className="text-base-content/30 hover:text-error hover:bg-error/10 mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
