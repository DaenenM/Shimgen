import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Plus } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ArchivedTournaments } from '@/features/tournaments/components/ArchivedTournaments'
import { DeleteTournamentDialog } from '@/features/tournaments/components/DeleteTournamentDialog'
import { RunBackDialog } from '@/features/tournaments/components/RunBackDialog'
import { TournamentList } from '@/features/tournaments/components/TournamentList'
import { useTournamentList } from '@/features/tournaments/hooks/useTournamentList'
import { paths } from '@/routes/paths'

// Tournaments list. Route: /tournaments
export function TournamentsPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { items, archivedItems, isLoading, favourite, archive, restore, remove, runBack } =
    useTournamentList({ enabled: isAuthenticated })

  // Tournament pending delete confirmation, held whole so the dialog can name it.
  const [confirming, setConfirming] = useState(null)
  // Tournament being run back, held whole so the dialog can name it.
  const [runningBack, setRunningBack] = useState(null)

  const cardHandlers = {
    // So a row can hide controls that would 403 for non-owners.
    viewer: user,
    onFavourite: (id) => favourite.mutate(id),
    onArchive: (id) => archive.mutate(id),
    onRestore: (id) => restore.mutate(id),
    onRunBack: (tournament) => setRunningBack(tournament),
    onDelete: (tournament) => setConfirming(tournament),
    pending: archive.isPending || restore.isPending,
  }

  return (
    <PageShell width="list" className="glass-backdrop">
      {/* Only the header animates — the list re-renders on every pin/archive/delete. */}
      <PageHeader
        className="rise-in rise-delay-1"
        title="Tournaments"
        description="Every event you host, help run or play in."
      >
        {/* Plain Link, not Button: plus icon animates on hover, full width on phone. */}
        <Link
          to={paths.quickStart}
          className="group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:w-auto"
        >
          <Plus className="h-4 w-4 transition-transform duration-200 ease-out group-hover:rotate-90" />
          New tournament
        </Link>
      </PageHeader>

      <ErrorAlert className="mb-4">{remove.error?.message}</ErrorAlert>

      <TournamentList
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        items={items}
        cardHandlers={cardHandlers}
      />

      {isAuthenticated && !isLoading && (
        <ArchivedTournaments items={archivedItems} cardHandlers={cardHandlers} />
      )}

      {/* Confirm first — this creates a whole new tournament. */}
      <RunBackDialog
        tournament={runningBack}
        pending={runBack.isPending}
        error={runBack.error?.message}
        onConfirm={() =>
          runBack.mutate(runningBack.id, {
            onSuccess: (tournament) => {
              setRunningBack(null)
              navigate(paths.tournament(tournament.id, tournament.title))
            },
          })
        }
        onCancel={() => setRunningBack(null)}
      />

      <DeleteTournamentDialog
        tournament={confirming}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirming.id, { onSuccess: () => setConfirming(null) })}
        onCancel={() => setConfirming(null)}
      />
    </PageShell>
  )
}
