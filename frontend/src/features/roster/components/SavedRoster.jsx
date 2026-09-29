import { useMemo } from 'react'

import { Archive, Check, Plus, Save, Trash2, User, Users, X } from '@/components/icons'
import { Toggle } from '@/components/ui/Toggle'

import { useAutoSaveRoster } from '../hooks/useAutoSaveRoster'
import { useRoster } from '../hooks/useRoster'

/**
 * The saved roster rail: every saved name, one click to put them in or take
 * them out of whatever is being built.
 *
 * The same rail on the team generator and the new-tournament form, and it
 * decides everything about how it looks and sizes itself — the pages only say
 * what is selected and where a click goes. Width, height, surface and title
 * used to be props, and each page set them differently: one capped the rail to
 * its neighbour's measured height, one to a fixed 26rem; one pinned the rail,
 * one pinned the column; one retitled it per team. The two rails drifted into
 * two different-feeling controls. Now there are no such props to disagree on.
 *
 * The list scrolls inside the rail past 26rem, or sooner on a short screen, so
 * a long roster never pushes the page. Pinning is the page column's job —
 * the new-tournament form stacks saved teams under this rail, and a sticky
 * child would ride up over its sibling.
 *
 * `target`, when a click lands in one of several places — a team in the
 * tournament form — is `{ label, color }` and is shown under the title, in the
 * team's colour, so it is clear where a name is about to go.
 */
export function SavedRoster({ selected, onAdd, onRemove, target = null }) {
  const { players, forget, archive, isLoading } = useRoster()
  const [autoSave, setAutoSave] = useAutoSaveRoster()

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

  // `min-w-0` so a long name truncates against the column rather than setting
  // its width.
  const shell = 'glass-panel flex w-full min-w-0 flex-col self-start'

  if (isLoading) {
    return (
      <aside className={shell}>
        <div className="flex flex-col gap-2 p-3">
          <span className="loading loading-spinner loading-sm self-center" />
        </div>
      </aside>
    )
  }

  return (
    <aside className={shell}>
      <div className="flex min-h-0 flex-col gap-3 py-3">
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">Saved roster</span>
            </span>
            {target && (
              <span
                className="mt-0.5 flex items-center gap-1.5 text-xs font-medium"
                style={{ color: target.color }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: target.color }}
                  aria-hidden="true"
                />
                <span className="truncate">Adding to {target.label}</span>
              </span>
            )}
          </div>
          {/* Icon only: the rail is narrow, and the save glyph on the knob says
              what the switch is for. The name is still there for hover and
              for screen readers. */}
          <Toggle
            label={autoSave ? 'Saving new names to your roster' : 'Not saving new names'}
            checked={autoSave}
            onChange={setAutoSave}
            icon={Save}
            hideLabel
          />
        </div>

        {players.length === 0 ? (
          <p className="text-base-content/40 px-3 py-4 text-center text-sm">
            Nobody saved yet. The names you add will show up here next time.
          </p>
        ) : (
          <ul className="max-h-[min(26rem,calc(100vh-14rem))] space-y-0.5 overflow-y-auto pr-1 pl-3">
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

                  {/* A friend, or you: archived rather than deleted.

                      Deleting takes their rating history with it, and that
                      history belongs to a person who is not the one clicking.
                      Archiving hides the row and keeps every number on it — so
                      the control stays useful and stops being destructive. The
                      server refuses the delete either way; this is the half
                      that explains why rather than waiting to be refused. */}
                  {player.is_friend || player.is_self ? (
                    <button
                      type="button"
                      onClick={() => archive(player)}
                      aria-label={`Archive ${player.display_name}`}
                      title="Archive — hides them and keeps their history"
                      className="text-base-content/30 hover:text-primary hover:bg-primary/10 mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => forget(player)}
                      aria-label={`Delete ${player.display_name} from saved roster`}
                      title="Delete from saved roster"
                      className="text-base-content/30 hover:text-error hover:bg-error/10 mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
