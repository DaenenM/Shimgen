import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ChevronDown, Plus, Trophy } from '@/components/icons'
import { useState } from 'react'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { TournamentCard } from '@/features/tournaments/TournamentCard'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

export function TournamentsPage() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // The tournament awaiting confirmation, held whole so the dialog can name it.
  // Deleting takes every match and result with it, which is worth a real pause.
  const [confirming, setConfirming] = useState(null)

  /**
   * Whether the archived section at the foot of the page is open.
   *
   * A disclosure rather than a mode. The previous toggle swapped the whole page
   * over to archived and swapped the header's meaning with it, which on a phone
   * was a 32px icon nobody found — and once found, left no way back except the
   * same invisible control. Archived tournaments are a footnote to the list, so
   * they live under it.
   */
  const [archivedOpen, setArchivedOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.tournaments.all, { archived: false }],
    queryFn: () => tournamentsApi.list(),
    // Nothing to list for a signed-out visitor — their brackets live in the
    // links they hold, not in an account.
    enabled: isAuthenticated,
  })

  // Fetched up front rather than on expand: the section only appears when it
  // has something in it, so the page has to know the count before anyone can
  // ask for it. A second short list is cheap next to hiding an empty control.
  const { data: archivedData } = useQuery({
    queryKey: [...queryKeys.tournaments.all, { archived: true }],
    queryFn: () => tournamentsApi.list({ archived: 'true' }),
    enabled: isAuthenticated,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
  }

  const favourite = useMutation({
    mutationFn: (tournamentId) => tournamentsApi.favourite(tournamentId),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (tournamentId) => tournamentsApi.remove(tournamentId),
    onSuccess: () => {
      setConfirming(null)
      invalidate()
      // Deleting takes the tournament's contribution off any linked board, so
      // the boards this tab holds are now wrong.
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
    },
  })

  const archive = useMutation({
    mutationFn: (tournamentId) => tournamentsApi.archive(tournamentId),
    onSuccess: invalidate,
  })

  const restore = useMutation({
    mutationFn: (tournamentId) => tournamentsApi.restore(tournamentId),
    onSuccess: invalidate,
  })

  const items = data?.results ?? data ?? []
  const archivedItems = archivedData?.results ?? archivedData ?? []
  const busy = archive.isPending || restore.isPending

  const cardHandlers = {
    onFavourite: (id) => favourite.mutate(id),
    onArchive: (id) => archive.mutate(id),
    onRestore: (id) => restore.mutate(id),
    onDelete: (tournament) => setConfirming(tournament),
    pending: busy,
  }

  return (
    <PageShell width="list">
      <PageHeader title="Tournaments" description="Every event you host, help run or play in.">
        <Button to={paths.quickStart} icon={Plus} block className="sm:w-auto">
          New tournament
        </Button>
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
          description="You can build a bracket without signing up, but an account is what keeps it, along with your roster and stats, for next Saturday."
          actionLabel="Create a bracket"
          actionTo={paths.quickStart}
        />
      ) : isLoading ? (
        // The header and its "New tournament" button are above and already
        // interactive: only the list is waiting on the server.
        <SectionLoader label="Loading your tournaments…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Paste in some names and you'll have a bracket in about ten seconds."
          actionLabel="Create your first"
          actionTo={paths.quickStart}
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} {...cardHandlers} />
          ))}
        </ul>
      )}

      {/* ── Archived ─────────────────────────────────────────────────────────
          Only rendered when something is actually archived. A permanent empty
          disclosure is a control that never does anything, and the count is
          what makes it worth a tap. */}
      {isAuthenticated && !isLoading && archivedItems.length > 0 && (
        <div className="border-base-300/70 mt-8 border-t pt-4">
          <button
            type="button"
            onClick={() => setArchivedOpen((open) => !open)}
            aria-expanded={archivedOpen}
            className="text-base-content/70 hover:text-base-content hover:bg-base-100 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            <Archive className="h-4 w-4 shrink-0" />
            <span>Archived tournaments</span>

            {/* The count sits in the label so the section says how much is
                behind it before it is opened. */}
            <span className="bg-base-300 text-base-content/70 rounded-full px-2 py-0.5 text-xs">
              {archivedItems.length}
            </span>

            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                archivedOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {archivedOpen && (
            <ul className="mt-2 grid gap-2">
              {archivedItems.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  archived
                  {...cardHandlers}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete ${confirming?.title || 'this tournament'}?`}
        // The board consequence is named only when there is a board, so the
        // warning stays true and does not become noise hosts click past.
        message={
          confirming?.feeds_stats_board
            ? 'Every match and result in it goes too — and the wins, losses and trophies it added to its stats board are taken back off. This cannot be undone. To keep the stats, archive it instead.'
            : 'Every match and result in it goes too. This cannot be undone. To keep it out of your list without losing the results, archive it instead.'
        }
        confirmLabel="Delete tournament"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirming.id)}
        onCancel={() => setConfirming(null)}
      />
    </PageShell>
  )
}
