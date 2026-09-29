import { useState } from 'react'

import { BarChart3, Plus } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BoardList } from '@/features/stats/components/BoardList'
import { NewBoardForm } from '@/features/stats/components/NewBoardForm'
import { useBoards } from '@/features/stats/hooks/useBoards'
import { paths } from '@/routes/paths'

/**
 * The boards a crew keeps.
 *
 * Most of a game night never becomes a bracket — someone wins a round of Pummel
 * Party and a name gets another emoji (plan §3). A board is where that lives,
 * and it is deliberately the crew's own shape: they name the tables, the
 * columns, and the mark that gets stamped.
 */
export function StatsPage() {
  const { isAuthenticated } = useAuth()
  const { boards, isLoading, create, remove, favourite } = useBoards({
    enabled: isAuthenticated,
  })

  const [creating, setCreating] = useState(false)
  // The board awaiting confirmation, held whole so the dialog can name it.
  // Deleting takes every tally on it, which is worth a real pause.
  const [confirming, setConfirming] = useState(null)

  if (!isAuthenticated) {
    return (
      <PageShell width="list" className="glass-backdrop">
        <PageHeader title="Stats" />
        <EmptyState
          icon={BarChart3}
          title="Stats need an account"
          description="A board keeps its tally between game nights, so it needs somewhere to live. Anyone you share the link with can see it without signing up."
          actionLabel="Create an account"
          actionTo={paths.register}
        />
      </PageShell>
    )
  }

  return (
    <PageShell width="list" className="glass-backdrop">
      <PageHeader
        className="rise-in rise-delay-1"
        title="Stats"
        description="Tally boards for the nights that never became a bracket."
      >
        {!creating && (
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New board
          </Button>
        )}
      </PageHeader>

      <ErrorAlert className="mb-4">{remove.error?.message}</ErrorAlert>

      {creating && <NewBoardForm create={create} onClose={() => setCreating(false)} />}

      <BoardList
        boards={boards}
        isLoading={isLoading}
        creating={creating}
        onCreate={() => setCreating(true)}
        onFavourite={(slug) => favourite.mutate(slug)}
        onDelete={setConfirming}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete ${confirming?.name ?? 'this board'}?`}
        message="Every table, player and tally on it goes too. This cannot be undone."
        confirmLabel="Delete board"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirming.slug, { onSuccess: () => setConfirming(null) })}
        onCancel={() => setConfirming(null)}
      />
    </PageShell>
  )
}
