import { Users } from '@/components/icons'
import { SectionLoader } from '@/components/ui/SectionLoader'

import { SavedTeamCard } from './SavedTeamCard'
import { TeamEditor } from './TeamEditor'

// Saved teams grid; the team being edited shows its editor in place of the card.
// Used by SavedTeamsPage.jsx.
export function SavedTeamList({
  teams,
  isLoading,
  editing,
  players,
  remember,
  update,
  busy,
  onEdit,
  onClose,
  onDelete,
}) {
  if (isLoading) return <SectionLoader label="Loading your teams…" />

  if (teams.length === 0 && editing !== 'new') {
    return (
      <div className="border-base-content/12 text-base-content/50 rounded-[1.25rem] border border-dashed p-10 text-center">
        <Users className="mx-auto h-6 w-6 opacity-50" />
        <p className="mt-2 text-sm">No teams saved yet.</p>
        <p className="text-base-content/40 mt-1 text-xs">
          Build one from your roster and it will be one click away next time.
        </p>
      </div>
    )
  }

  return (
    <ul className="rise-in rise-delay-2 grid gap-3 sm:grid-cols-2">
      {teams.map((team) =>
        editing === team.id ? (
          <li key={team.id} className="sm:col-span-2">
            <TeamEditor
              team={team}
              players={players}
              remember={remember}
              pending={update.isPending}
              error={update.error?.message}
              onCancel={onClose}
              onSave={(payload) =>
                update.mutate({ id: team.id, ...payload }, { onSuccess: onClose })
              }
            />
          </li>
        ) : (
          <SavedTeamCard
            key={team.id}
            team={team}
            disabled={busy}
            onEdit={() => onEdit(team.id)}
            onDelete={() => onDelete(team)}
          />
        ),
      )}
    </ul>
  )
}
