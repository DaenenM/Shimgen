import { SavedRoster } from '@/features/roster/components/SavedRoster'
import { SavedTeamPicker } from '@/features/teams/components/SavedTeamPicker'
import { teamTone } from '@/features/teams/utils/tone'

// Left column of the new-tournament form: saved players and saved teams. Used by QuickStartPage.jsx.
export function RosterRail({ form, className = '' }) {
  const { mode } = form

  return (
    <div className={`flex min-w-0 flex-col gap-4 ${className}`}>
      <SavedRoster
        selected={form.placed}
        onAdd={form.addFromRoster}
        onRemove={form.removeFromRoster}
        teams={
          mode === 'teams'
            ? form.teams.map((team, index) => ({
                label: team.label.trim() || `Team ${index + 1}`,
                color: teamTone(index).edge,
                members: team.members,
              }))
            : null
        }
        target={
          mode === 'teams' && form.teams.length > 0
            ? {
                label: form.teams[form.activeTeam]?.label.trim() || `Team ${form.activeTeam + 1}`,
                color: teamTone(form.activeTeam).edge,
              }
            : null
        }
      />

      {/* Teams mode only -- a saved team has nowhere to go in solo mode. */}
      {mode === 'teams' && (
        <SavedTeamPicker
          onPick={form.addSavedTeam}
          placed={form.teams.map((team) => team.label)}
          glass
        />
      )}
    </div>
  )
}
