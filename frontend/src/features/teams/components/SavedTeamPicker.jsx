import { Plus, Users } from '@/components/icons'
import { TeamCrest } from '@/components/ui/TeamCrest'

import { useSavedTeams } from '../hooks/useSavedTeams'

// Saved-teams rail: one click adds a whole team + its members to the form.
// Used by RosterRail.jsx (new-tournament) and TeamGeneratorPage-adjacent flows in teams mode only.
// Renders nothing while loading or if there are no saved teams.
export function SavedTeamPicker({ onPick, placed = [], glass = false, maxHeight = null }) {
  const { teams, isLoading } = useSavedTeams()

  const surface = glass ? 'glass-panel' : 'card bg-base-100 border-base-300 border'
  // min-w-0 lets the card shrink below its content's intrinsic width so truncate can engage.
  const sizing = maxHeight
    ? 'w-full min-w-0 self-start overflow-hidden'
    : 'w-full min-w-0 self-start'
  const capStyle = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined

  // Matched by name since the form holds labels/members, not ids.
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
