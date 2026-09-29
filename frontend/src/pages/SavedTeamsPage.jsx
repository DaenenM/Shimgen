import { useState } from 'react'

import { Plus } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { useRoster } from '@/features/roster/hooks/useRoster'
import { SavedTeamList } from '@/features/teams/components/SavedTeamList'
import { TeamEditor } from '@/features/teams/components/TeamEditor'
import { useSavedTeams } from '@/features/teams/hooks/useSavedTeams'

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

      <SavedTeamList
        teams={teams}
        isLoading={isLoading}
        editing={editing}
        players={players}
        remember={remember}
        update={update}
        busy={busy}
        onEdit={setEditing}
        onClose={close}
        onDelete={setConfirming}
      />

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
