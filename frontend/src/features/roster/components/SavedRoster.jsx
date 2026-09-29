import { useMemo } from 'react'

import { Archive, Check, Plus, Save, Trash2, User, Users, X } from '@/components/icons'
import { Toggle } from '@/components/ui/Toggle'

import { useAutoSaveRoster } from '../hooks/useAutoSaveRoster'
import { useRoster } from '../hooks/useRoster'

// Saved roster rail: click a name to add/remove it from whatever is being built.
// Used by RosterRail.jsx, TeamGeneratorPage.jsx.
// Owns its own sizing (scrolls past 26rem) so callers only pass selection state.
// `target` (optional `{ label, color }`) shows which team/spot a click adds to.
// `colorOf` (optional `name => css colour | null`) tints an added player in their
// team's colour instead of the default green.
export function SavedRoster({ selected, onAdd, onRemove, target = null, colorOf = null }) {
  const { players, forget, archive, isLoading } = useRoster()
  const [autoSave, setAutoSave] = useAutoSaveRoster()

  // Order: you first (pinned), then friends alphabetically, then everyone else
  // in the server's most-recently-played order. Sorted here, not in useRoster,
  // since other consumers of that hook want the recency order untouched.
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

  const shell = 'glass-panel flex w-full min-w-0 flex-col self-start' // min-w-0 lets long names truncate

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
          {/* Icon-only for the narrow rail; label still present for hover/screen readers. */}
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
              const teamColor = added ? colorOf?.(player.display_name) : null

              return (
                <li key={player.id ?? player.display_name} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      added ? onRemove(player.display_name) : onAdd(player.display_name)
                    }
                    // Toggles rather than disables, so a mis-click can be undone the same way.
                    aria-pressed={added}
                    title={added ? `Remove ${player.display_name}` : `Add ${player.display_name}`}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 ${
                      added
                        ? `${teamColor ? 'text-(--team)' : 'text-success'} hover:bg-error/10 hover:text-error`
                        : 'hover:bg-primary/10 hover:text-primary'
                    }`}
                    // Set as a variable, not `color`, so the red hover can still override it.
                    style={teamColor ? { '--team': teamColor } : undefined}
                  >
                    {added ? (
                      // Tick at rest, cross on hover, same slot to avoid reflow.
                      <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
                        <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
                        <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                      </span>
                    ) : (
                      <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    )}
                    <span className="truncate font-medium">{player.display_name}</span>

                    {/* Friends only, not merely linked (a co-host who claimed a bracket isn't a friend). */}
                    {player.is_self ? (
                      <User
                        // Amber matches the roster page's own linked-account icon.
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

                  {/* Friend or self: archive, not delete — deleting would cascade away their rating history. */}
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
