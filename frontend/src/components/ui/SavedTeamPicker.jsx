import { Plus, Users } from '@/components/icons'

import { TeamCrest } from '@/components/ui/TeamCrest'
import { useSavedTeams } from '@/hooks/useSavedTeams'

/**
 * Saved squads, ready to drop into the form.
 *
 * The sibling of `SavedRoster`, and deliberately the same shape: a rail beside
 * the form, one click per entry, no confirmation step. The difference is what a
 * click inserts — a roster click adds one name, a team click adds the whole
 * side and its members at once.
 *
 * Only useful in teams mode. In solo mode a "team" has nowhere to go, so the
 * caller hides it rather than this rendering a panel whose entries do nothing.
 *
 * Renders nothing until there is at least one saved team — an empty panel is a
 * whole card beside the form that offers nothing to click. That includes while
 * loading, so it never shows a spinner only to vanish.
 */
export function SavedTeamPicker({ onPick, placed = [], glass = false, maxHeight = null }) {
  const { teams, isLoading } = useSavedTeams()

  const surface = glass ? 'glass-panel' : 'card bg-base-100 border-base-300 border'
  // `min-w-0 w-full` is what lets the card be bounded by its column rather than
  // by its widest line. A grid/flex child defaults to `min-width: auto`, so it
  // refuses to shrink below its content's intrinsic width — which meant a team
  // whose members read "Big Kirk, Brett, Il, Pig Benis, ShimBob" pushed this
  // panel wider than the roster rail above it, and `truncate` never engaged
  // because nothing upstream ever constrained the width.
  const sizing = maxHeight
    ? 'w-full min-w-0 self-start overflow-hidden'
    : 'w-full min-w-0 self-start'
  const capStyle = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined

  // Which teams are already in the form, matched by name — the form holds
  // labels and members, not ids, so the name is the only handle back to the
  // saved team it came from.
  const used = new Set(placed.map((label) => label.toLowerCase()))

  if (isLoading || teams.length === 0) return null

  return (
    <aside className={`${surface} ${sizing} flex flex-col`} style={capStyle}>
      <div className="flex min-h-0 flex-col gap-3 py-3">
        <div className="px-3">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4" />
            Saved teams
          </span>
        </div>

        <ul
          className={`space-y-0.5 overflow-y-auto pr-1 pl-3 ${maxHeight ? 'min-h-0' : 'max-h-[26rem]'}`}
        >
          {teams.map((team) => {
            const added = used.has(team.name.toLowerCase())

            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => onPick(team)}
                  disabled={added}
                  title={
                    added
                      ? `${team.name} is already in this tournament`
                      : `Add ${team.name} and its ${team.members.length} player${
                          team.members.length === 1 ? '' : 's'
                        }`
                  }
                  className="hover:bg-primary/10 hover:text-primary flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
                >
                  <TeamCrest team={team} size="sm" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{team.name}</span>
                    <span className="text-base-content/50 block truncate text-xs">
                      {team.members.length === 0
                        ? 'No players yet'
                        : team.members.map((m) => m.display_name).join(', ')}
                    </span>
                  </span>

                  {!added && <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
