import { Check, Plus, Trash2, User, Users, X } from '@/components/icons'
import { useMemo } from 'react'

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

  /**
   * You first, then friends alphabetically, then everybody else as they came.
   *
   * Your own name is the one most likely to be wanted and the one nobody should
   * have to hunt for, so it is pinned rather than sorted among the rest.
   *
   * A partition rather than one comparator, because the two halves are ordered
   * by different rules. The server sends the roster most-recently-played first,
   * which is deliberate — the names from last Saturday are the ones you want
   * nearest the top — and that ordering is kept for everyone who is not a
   * friend rather than being flattened into one alphabetical list.
   *
   * Sorted here rather than in `useRoster` or the queryset: six other
   * components read the same hook, and the picker, the team builder and the
   * board all want the recency order untouched.
   */
  const ordered = useMemo(() => {
    const me = players.filter((player) => player.is_self)
    const friends = players.filter((player) => player.is_friend && !player.is_self)
    const rest = players.filter((player) => !player.is_friend && !player.is_self)

    friends.sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' }),
    )

    return [...me, ...friends, ...rest]
  }, [players])

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
            {ordered.map((player) => {
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

                    {/* Friends only, not merely linked: a co-host who claimed a
                        bracket has an account attached without being someone
                        you play with. This is what says the row keeps itself up
                        to date with their name.

                        The glyph replaces a "Friend" pill, so the meaning it
                        used to carry in words now lives in the title and the
                        accessible label — an icon on its own tells a screen
                        reader nothing. */}
                    {player.is_self ? (
                      <User
                        // Amber, matching the roster page's own linked-account
                        // icon: the same glyph should not mean one thing in one
                        // list and something else in another.
                        className="text-accent ml-auto h-3.5 w-3.5 shrink-0"
                        aria-label="You"
                        role="img"
                      >
                        <title>You — adding this attaches your account</title>
                      </User>
                    ) : (
                      player.is_friend && (
                        <Users
                          className="text-primary ml-auto h-3.5 w-3.5 shrink-0"
                          aria-label="Friend"
                          role="img"
                        >
                          <title>Friend — this name follows their account</title>
                        </Users>
                      )
                    )}
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
