import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ChevronDown, Plus, RotateCcw, Trophy } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { TournamentCard } from '@/features/tournaments/TournamentCard'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * "Run it back" — confirming a restage.
 *
 * Its own dialog rather than `ConfirmDialog`, which is built for destruction:
 * red button, warning triangle, "this cannot be undone". None of that is true
 * here — the original keeps every result, and this only adds. It still asks,
 * because it creates a whole tournament.
 *
 * Deliberately not on DaisyUI's `.modal`. That class carries a 300ms
 * visibility/background transition and its own translate and scale corrections,
 * which are applied to `.modal-box` — a class this does not use, since the
 * surface is the app's own glass. The result was a panel sitting low on the
 * screen that smeared away on close. Styling the <dialog> directly is both
 * fewer moving parts and the only way to get an instant dismissal.
 */
function RunBackDialog({ tournament, pending, error, onConfirm, onCancel }) {
  const ref = useRef(null)
  const open = Boolean(tournament)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // `m-auto` against `inset-0` is what centres a <dialog> in both axes.
      // The browser's own default is `margin: auto` on a positioned box, but
      // the UA stylesheet also sets `top`/`bottom` to the block-start edge,
      // which is what leaves an unstyled dialog sitting high — or, with a
      // library's overrides half-applied, low.
      className="fixed inset-0 m-auto max-h-fit w-[calc(100%-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-transparent"
      onClose={onCancel}
      // Clicking the backdrop cancels. The dialog element itself fills the
      // viewport only as far as its own box, so a click landing on it rather
      // than on the panel inside is a click outside the panel.
      onMouseDown={(event) => {
        if (event.target === ref.current) onCancel()
      }}
    >
      {/* Centred rather than an icon-beside-text row. The icon tile against a
          two-line paragraph left three different left edges and no alignment
          anywhere — the tile's, the heading's, and the text's. A single centred
          column has one axis, which is what makes a small card read as composed
          rather than assembled.

          One padding value throughout, and every gap a multiple of it, so the
          vertical rhythm is even top to bottom. */}
      <div className="glass-raised flex flex-col items-center gap-4 p-6 text-center">
        <span className="bg-success/12 text-success grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <RotateCcw className="h-5 w-5" />
        </span>

        <div className="space-y-1.5">
          <h3 className="text-lg leading-tight font-bold tracking-tight">Run it back?</h3>
          {/* `text-sm` rather than `text-xs`: this is the sentence explaining
              what the button does, and it was set smaller than the buttons
              underneath it. Balanced wrapping keeps two lines even rather than
              leaving one word stranded. */}
          <p className="text-base-content/70 text-sm text-balance">
            A fresh bracket with the same entrants, freshly paired
            {tournament?.feeds_stats_board ? ', counting towards the same board' : ''}.
          </p>
          {/* The name on its own line. Inlined into the sentence it pushed the
              paragraph to three ragged lines and buried the one piece of the
              text that changes. */}
          {tournament?.title && (
            <p className="text-base-content/50 truncate text-xs">
              {tournament.title} keeps its results
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="border-error/30 bg-error/12 text-error w-full rounded-lg border px-3 py-2 text-xs"
          >
            {error}
          </div>
        )}

        {/* Full width and equal halves. Two shrink-wrapped buttons pushed right
            left a ragged bottom edge on a card this narrow; splitting the row
            gives the panel a base to sit on.

            Colour and border on hover, nothing that moves — a panel that has
            just appeared under the cursor should not also shift under it. */}
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="glass-raised hover:border-base-content/30 hover:bg-base-content/8 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-primary text-primary-content hover:bg-primary/85 shadow-primary/20 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Run it back
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function TournamentsPage() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // The tournament awaiting confirmation, held whole so the dialog can name it.
  // Deleting takes every match and result with it, which is worth a real pause.
  const [confirming, setConfirming] = useState(null)

  // The tournament being run back, held whole so the dialog can name it.
  const [runningBack, setRunningBack] = useState(null)

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

  /**
   * Run a night back: a fresh draft with the same entrants and the same board.
   *
   * Opens on the new bracket rather than returning to the list. Restaging is
   * something a host does *in order to play it*, so leaving them on the list to
   * find it themselves would put a step between the decision and the thing they
   * decided to do.
   */
  const runBack = useMutation({
    // Always reshuffled. Running it back means playing it again, not replaying
    // the same fixtures — and a rematch of the identical first round is the one
    // thing nobody asks for twice.
    mutationFn: (id) => tournamentsApi.restage(id, { reshuffle: true }),
    onSuccess: (tournament) => {
      setRunningBack(null)
      invalidate()
      // The clone enrols its players on the linked board straight away, so the
      // boards this tab holds are now out of date.
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
      navigate(paths.tournament(tournament.id, tournament.title))
    },
  })

  const items = data?.results ?? data ?? []
  const archivedItems = archivedData?.results ?? archivedData ?? []
  const busy = archive.isPending || restore.isPending

  const cardHandlers = {
    onFavourite: (id) => favourite.mutate(id),
    onArchive: (id) => archive.mutate(id),
    onRestore: (id) => restore.mutate(id),
    onRunBack: (tournament) => setRunningBack(tournament),
    onDelete: (tournament) => setConfirming(tournament),
    pending: busy,
  }

  return (
    <PageShell width="list" className="glass-backdrop">
      {/* Only the header. The list below re-renders on every pin, archive and
          delete — animating it would replay the page's entrance each time
          somebody used one of those buttons. */}
      <PageHeader
        className="rise-in rise-delay-1"
        title="Tournaments"
        description="Every event you host, help run or play in."
      >
        {/* Styled here rather than through `Button`, which is still on the old
            DaisyUI variants and used across every page — converting it moves
            the whole app at once and belongs to its own pass. */}
        <Link
          to={paths.quickStart}
          className="group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:w-auto"
        >
          <Plus className="h-4 w-4 transition-transform duration-200 ease-out group-hover:rotate-90" />
          New tournament
        </Link>
      </PageHeader>

      {remove.isError && (
        <div
          role="alert"
          className="border-error/30 bg-error/12 text-error mb-4 rounded-xl border px-3 py-2 text-sm"
        >
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
        <div className="border-base-content/10 mt-8 border-t pt-4">
          <button
            type="button"
            onClick={() => setArchivedOpen((open) => !open)}
            aria-expanded={archivedOpen}
            className="text-base-content/70 hover:text-base-content hover:bg-base-content/8 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors duration-200"
          >
            <Archive className="h-4 w-4 shrink-0" />
            <span>Archived tournaments</span>

            {/* The count sits in the label so the section says how much is
                behind it before it is opened. */}
            <span className="bg-base-content/10 text-base-content/70 rounded-full px-2 py-0.5 text-xs">
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

      {/* Running a night back.

          A confirmation rather than a straight click, because it creates a
          whole tournament and puts a new row at the top of the list. Not styled
          as a danger, since nothing is destroyed: the original keeps every
          result. */}
      <RunBackDialog
        tournament={runningBack}
        pending={runBack.isPending}
        error={runBack.isError ? runBack.error.message : null}
        onConfirm={() => runBack.mutate(runningBack.id)}
        onCancel={() => setRunningBack(null)}
      />

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
