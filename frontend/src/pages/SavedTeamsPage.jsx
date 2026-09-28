import { Plus, Users } from '@/components/icons'
import { useState } from 'react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { SavedTeamCard } from '@/features/teams/SavedTeamCard'
import { TeamEditor } from '@/features/teams/TeamEditor'
import { useRoster } from '@/hooks/useRoster'
import { useSavedTeams } from '@/hooks/useSavedTeams'

/**
 * Squads kept between game nights.
 *
 * The roster answers "who plays"; this answers "who plays *together*". A crew
 * running the same four teams every Saturday picks the team in the new
 * tournament form and its members come with it, rather than rebuilding the
 * same sides each week.
 */
export function SavedTeamsPage() {
  const { teams, isLoading, create, update, remove } = useSavedTeams()
  const { players, remember } = useRoster()

  // The team being edited, or 'new' while one is being created. One at a time:
  // a page of simultaneously open editors is a page where it is unclear which
  // set of changes a save applies to.
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const busy = create.isPending || update.isPending || remove.isPending
  const close = () => setEditing(null)

  return (
    <PageShell className="glass-backdrop">
      <div className="rise-in rise-delay-1">
        <PageHeader
          title="Saved Teams"
          description="Squads you keep between game nights, ready to drop into a bracket."
        >
          <Button icon={Plus} onClick={() => setEditing('new')} disabled={editing === 'new'}>
            New team
          </Button>
        </PageHeader>
      </div>

      {editing === 'new' && (
        <div className="rise-in mb-4">
          <TeamEditor
            players={players}
            remember={remember}
            pending={create.isPending}
            error={create.error?.message}
            onCancel={close}
            onSave={(payload) => create.mutate(payload, { onSuccess: close })}
          />
        </div>
      )}

      {isLoading ? (
        <SectionLoader label="Loading your teams…" />
      ) : teams.length === 0 && editing !== 'new' ? (
        <div className="border-base-content/12 text-base-content/50 rounded-[1.25rem] border border-dashed p-10 text-center">
          <Users className="mx-auto h-6 w-6 opacity-50" />
          <p className="mt-2 text-sm">No teams saved yet.</p>
          <p className="text-base-content/40 mt-1 text-xs">
            Build one from your roster and it will be one click away next time.
          </p>
        </div>
      ) : (
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
                  onCancel={close}
                  onSave={(payload) =>
                    update.mutate({ id: team.id, ...payload }, { onSuccess: close })
                  }
                />
              </li>
            ) : (
              <SavedTeamCard
                key={team.id}
                team={team}
                disabled={busy}
                onEdit={() => setEditing(team.id)}
                onDelete={() => setConfirming(team)}
              />
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete ${confirming?.name ?? 'this team'}?`}
        message="The team goes; the people on it stay in your roster."
        confirmLabel="Delete team"
        onConfirm={() => {
          remove.mutate(confirming.id)
          setConfirming(null)
        }}
        onCancel={() => setConfirming(null)}
      />
    </PageShell>
  )
}
