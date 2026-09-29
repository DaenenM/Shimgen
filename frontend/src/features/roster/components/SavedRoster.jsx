import { useMemo } from 'react'

import { Save, Users } from '@/components/icons'
import { Toggle } from '@/components/ui/Toggle'

import { useAutoSaveRoster } from '../hooks/useAutoSaveRoster'
import { useRoster } from '../hooks/useRoster'
import { SavedRosterRow } from './SavedRosterRow'

// Saved roster rail: click a name to add/remove it from whatever is being built.
// Used by RosterRail.jsx, TeamGeneratorPage.jsx.
// Owns its own sizing (scrolls past 26rem) so callers only pass selection state.
// `target` (optional `{ label, color }`) shows which team/spot a click adds to.
// `teams` (optional `[{ label, color, members }]`) groups the list by team under
// coloured headings, each player tinted in their team's colour; the rest follow.
export function SavedRoster({ selected, onAdd, onRemove, target = null, teams = null }) {
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

  // Without teams: one ungrouped list. With teams: a group per team that has
  // saved players on it (in the team's own member order), then everyone else.
  const groups = useMemo(() => {
    if (!teams) return [{ key: 'all', players: ordered }]

    const byName = new Map(ordered.map((p) => [p.display_name.toLowerCase(), p]))
    const used = new Set()

    const teamGroups = teams
      .map((team, index) => {
        const members = team.members
          .map((name) => byName.get(name.toLowerCase()))
          .filter((p) => p && !used.has(p) && used.add(p))
        return { key: `team-${index}`, label: team.label, color: team.color, players: members }
      })
      .filter((group) => group.players.length > 0)

    const rest = ordered.filter((p) => !used.has(p))
    if (teamGroups.length === 0) return [{ key: 'all', players: rest }]

    return [
      ...teamGroups,
      ...(rest.length ? [{ key: 'rest', label: 'Not on a team', players: rest }] : []),
    ]
  }, [ordered, teams])

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
          <ul className="max-h-[min(26rem,calc(100vh-14rem))] overflow-y-auto pr-1 pl-3">
            {groups.map((group) => (
              <li key={group.key} className="space-y-0.5 not-first:mt-2">
                {group.label && (
                  <p
                    className="flex items-center gap-1.5 px-1 pt-1 pb-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase"
                    style={{ color: group.color }}
                  >
                    {group.color && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span className={`truncate ${group.color ? '' : 'text-base-content/45'}`}>
                      {group.label}
                    </span>
                  </p>
                )}

                <ul className="space-y-0.5">
                  {group.players.map((player) => (
                    <SavedRosterRow
                      key={player.id ?? player.display_name}
                      player={player}
                      added={chosen.has(player.display_name.toLowerCase())}
                      teamColor={group.color}
                      onAdd={onAdd}
                      onRemove={onRemove}
                      onArchive={archive}
                      onForget={forget}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
