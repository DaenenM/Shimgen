import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Star, Trash2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/PageLoader'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

const FORMAT_LABELS = {
  single: 'Single elim',
  double: 'Double elim',
  rr: 'Round robin',
  swiss: 'Swiss',
  ffa: 'Free-for-all',
}

const STATE_BADGE = {
  draft: 'badge-ghost',
  active: 'badge-primary',
  complete: 'badge-success',
}

export function TournamentsPage() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // The tournament awaiting confirmation, held whole so the dialog can name it.
  // Deleting takes every match and result with it, which is worth a real pause.
  const [confirming, setConfirming] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tournaments.all,
    queryFn: tournamentsApi.list,
    // Nothing to list for a signed-out visitor — their brackets live in the
    // links they hold, not in an account.
    enabled: isAuthenticated,
  })

  const favourite = useMutation({
    mutationFn: (tournamentId) => tournamentsApi.favourite(tournamentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all }),
  })

  const remove = useMutation({
    mutationFn: (tournamentId) => tournamentsApi.remove(tournamentId),
    onSuccess: () => {
      setConfirming(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
    },
  })

  if (isAuthenticated && isLoading) return <PageLoader label="Loading tournaments…" />

  const items = data?.results ?? data ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="Tournaments" description="Every event you host, help run or play in.">
        <Link to={paths.quickStart} className="btn btn-primary btn-sm gap-2">
          <Plus className="h-4 w-4" />
          New tournament
        </Link>
      </PageHeader>

      {remove.isError && (
        <div role="alert" className="alert alert-error mb-4 py-2 text-sm">
          {remove.error.message}
        </div>
      )}

      {!isAuthenticated ? (
        <EmptyState
          icon={Trophy}
          title="Your tournaments live in your account"
          description="You can build a bracket without signing up — but an account is what keeps it, along with your roster and stats, for next Saturday."
          actionLabel="Create a bracket"
          actionTo={paths.quickStart}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Paste in some names and you'll have a bracket in about ten seconds."
          actionLabel="Create your first"
          actionTo={paths.quickStart}
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((tournament) => (
            <li
              key={tournament.id}
              className="group card bg-base-100 border-base-300 border transition-shadow hover:shadow-md"
            >
              <div className="card-body flex-row items-center gap-4 p-4">
                {/* The link covers the card's own area rather than wrapping it,
                    so the delete button can sit alongside — a button nested in
                    an anchor is invalid and swallows its own clicks. */}
                <Link
                  to={paths.tournament(tournament.id, tournament.title)}
                  className="min-w-0 flex-1"
                >
                  <h3 className="truncate font-semibold">
                    {tournament.title || 'Untitled tournament'}
                  </h3>
                  <p className="text-base-content/60 mt-0.5 text-sm">
                    {FORMAT_LABELS[tournament.format] ?? tournament.format} ·{' '}
                    {tournament.entrant_count}{' '}
                    {tournament.entrant_count === 1 ? 'entrant' : 'entrants'}
                  </p>
                </Link>

                <span
                  className={`badge shrink-0 ${STATE_BADGE[tournament.state] ?? 'badge-ghost'}`}
                >
                  {tournament.state}
                </span>

                <button
                  onClick={() => favourite.mutate(tournament.id)}
                  aria-label={
                    tournament.favourited_at
                      ? `Unpin ${tournament.title || 'tournament'}`
                      : `Pin ${tournament.title || 'tournament'} to the top`
                  }
                  title={tournament.favourited_at ? 'Unpin' : 'Pin to the top'}
                  // A pinned tournament keeps its star visible; an unpinned one
                  // shows it on hover, so the list reads as tournaments rather
                  // than a column of stars.
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-150 focus-visible:opacity-100 ${
                    tournament.favourited_at
                      ? 'text-warning hover:bg-warning/10 opacity-100'
                      : 'text-base-content/40 hover:text-warning hover:bg-warning/10 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star
                    className="h-4 w-4"
                    fill={tournament.favourited_at ? 'currentColor' : 'none'}
                  />
                </button>

                <button
                  onClick={() => setConfirming(tournament)}
                  aria-label={`Delete ${tournament.title || 'tournament'}`}
                  title="Delete tournament"
                  // Revealed on hover so a list reads as tournaments rather
                  // than a column of bins, but always reachable by keyboard.
                  className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-9 w-9 shrink-0 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete ${confirming?.title || 'this tournament'}?`}
        message="Every match and result in it goes too. This cannot be undone."
        confirmLabel="Delete tournament"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirming.id)}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
