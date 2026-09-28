import { BarChart3, Plus, Table2 } from '@/components/icons'
import { useState } from 'react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { BoardListItem } from '@/features/stats/BoardListItem'
import { NewBoardForm } from '@/features/stats/NewBoardForm'
import { useBoards } from '@/features/stats/useBoards'
import { useAuth } from '@/hooks/useAuth'
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
      <PageShell className="glass-backdrop">
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
    <PageShell className="glass-backdrop">
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

      {isLoading ? (
        // Only the list waits. The header and its "New board" button are above
        // and already interactive, so the page is usable before the fetch lands.
        <SectionLoader label="Loading your boards…" />
      ) : boards.length === 0 && !creating ? (
        <EmptyState
          icon={Table2}
          title="No boards yet"
          description="A board is a list of names and the things you count for them: solo wins, team wins, whatever your crew argues about."
          actionLabel="Create a board"
          onAction={() => setCreating(true)}
        />
      ) : (
        // A list rather than a grid of cards. Boards are a short, scanned
        // list — you are looking for one name — and a single column keeps every
        // name on the same left edge instead of making the eye zigzag.
        <ul className="glass-panel divide-base-content/8 divide-y overflow-hidden">
          {boards.map((board) => (
            <BoardListItem
              key={board.slug}
              board={board}
              onFavourite={() => favourite.mutate(board.slug)}
              onDelete={() => setConfirming(board)}
            />
          ))}
        </ul>
      )}

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
