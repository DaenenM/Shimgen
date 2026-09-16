import { Plus, Users } from '@/components/icons'

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
            Saved teams
          </span>
          <p className="text-base-content/50 mt-0.5 text-xs">
            {teams.length === 0
              ? 'Squads you save show up here.'
              : 'Click a team to add it and its players.'}
          </p>
        </div>

        {teams.length === 0 ? (
          <p className="text-base-content/40 px-3 py-4 text-center text-sm">
            No saved teams yet. Build one from your roster and it will be one click away.
          </p>
        ) : (
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
                    <TeamCrest team={team} />

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
        )}
      </div>
    </aside>
  )
}

/** The team's logo, or its initial when it has none. */
function TeamCrest({ team }) {
  if (team.logo) {
    return <img src={team.logo} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
  }

  return (
    <span
      className="from-primary to-secondary text-primary-content grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br text-[0.625rem] font-bold"
      aria-hidden="true"
    >
      {(team.name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
