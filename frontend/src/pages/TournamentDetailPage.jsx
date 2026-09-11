import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Play, Share2, Trophy, Users } from '@/components/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { BracketView } from '@/features/bracket/BracketView'
import { CohostManager } from '@/features/bracket/CohostManager'
import { EditableTitle } from '@/features/bracket/EditableTitle'
import { EntrantRoster } from '@/features/bracket/EntrantRoster'
import { RoundList } from '@/features/bracket/RoundList'
import { SaveIndicator } from '@/features/bracket/SaveIndicator'
import { StandingsTable } from '@/features/bracket/StandingsTable'
import { FORMAT_LABELS } from '@/features/bracket/layout'
import { applyResult, clearResult, scoreForClick } from '@/features/bracket/optimistic'
import { useReportQueue } from '@/features/bracket/useReportQueue'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

// Formats with no tree to draw: nobody is eliminated, so a bracket layout
// would imply a structure that is not there.
const LIST_FORMATS = new Set(['rr', 'swiss', 'ffa'])

export function TournamentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  // Set when a flush is rejected, so the host is told rather than silently
  // watching the bracket snap back to the server's version.
  const [syncError, setSyncError] = useState(null)
  /**
   * Where this visit's results stand: 'idle' | 'saving' | 'saved'.
   *
   * Three states rather than a boolean because "nothing reported yet" and
   * "everything reported is stored" both mean nothing is pending, and only one
   * of them has earned a checkmark. Once it reaches 'saved' it stays there for
   * the rest of the visit, so a host can glance up at any point and see that
   * the night is recorded.
   */
  const [saveState, setSaveState] = useState('idle')

  const { data: tournament, isLoading } = useQuery({
    queryKey: queryKeys.tournaments.detail(id),
    queryFn: () => tournamentsApi.get(id),
  })

  const { data: standings } = useQuery({
    queryKey: queryKeys.tournaments.standings(id),
    queryFn: () => tournamentsApi.standings(id),
    enabled: Boolean(tournament),
  })

  // Arriving by the bare id — an old link, or one typed by hand — rewrites the
  // address bar to the named form, so copying from the browser gives the same
  // shape the share link does. `replace` keeps it out of the back stack.
  const canonical = tournament ? paths.tournament(tournament.id, tournament.title) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  // Both the bracket and the standings derive from the same match rows, so any
  // result invalidates both — standings are computed, never stored. One
  // invalidation covers them: React Query matches keys by prefix, and
  // ['tournaments', id] is a prefix of ['tournaments', id, 'standings'].
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
  }

  /**
   * Refresh the detail *and* the list behind it.
   *
   * Used where the tournament's state changes — starting it, or a result
   * finishing it — because the list shows that state as a badge and would
   * otherwise keep serving a cached "draft" for the next two minutes. Kept
   * separate from `refresh` so an ordinary reported result does not refetch the
   * whole list on every click.
   */
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
    // A linked board moves with the tournament's state — finishing one awards
    // the trophy — so its cache cannot be left claiming to be fresh.
    queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
  }

  /**
   * Apply a change to the cached bracket immediately.
   *
   * Waiting for the request meant a visible pause on every click — the button
   * did nothing until a report and a refetch had both completed. Writing the
   * result into the cache first makes the bracket move on the click; the
   * refetch in onSettled then reconciles anything this simplified copy of the
   * advancement rules got wrong.
   *
   * The previous cache entry is returned so onError can roll back.
   */
  const optimistically = (transform) => {
    const key = queryKeys.tournaments.detail(id)

    // The cache is written first and synchronously. Awaiting cancelQueries
    // before this — the obvious ordering — made every click wait on an
    // in-flight request aborting, because React Query holds the mutation until
    // onMutate resolves. That turned a sub-50ms repaint into a visible pause.
    const previous = queryClient.getQueryData(key)
    if (previous) {
      queryClient.setQueryData(key, {
        ...previous,
        matches: transform(previous.matches),
      })
    }

    // Then stop any in-flight refetch from landing on top of the local edit.
    // Not awaited: it only has to happen, not happen first.
    queryClient.cancelQueries({ queryKey: key })

    return { previous }
  }

  /**
   * The score a click should post, resolved against the freshest cached match.
   *
   * Reading the cache rather than the rendered props is what makes rapid clicks
   * on one series count: the optimistic write lands synchronously, so the
   * second click sees what the first one wrote.
   */
  const resolveClick = (matchId, side) => {
    const cached = queryClient.getQueryData(queryKeys.tournaments.detail(id))
    return scoreForClick(
      cached?.matches?.find((m) => m.id === matchId),
      side,
    )
  }

  /**
   * Send a run of queued results as one request.
   *
   * The response is the whole bracket, so it replaces the cache outright — this
   * is both the write and the reconcile. Nothing is invalidated afterwards: a
   * refetch here would only re-fetch what just came back.
   */
  const sendBatch = useCallback(
    async (operations) => {
      const fresh = await tournamentsApi.batchReport(id, operations)
      queryClient.setQueryData(queryKeys.tournaments.detail(id), fresh)
      // Standings are computed from the same rows, and the list shows the state
      // badge that a finished tournament has just changed.
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.standings(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
      // A linked board is updated server-side by the same request — games
      // played, won, lost, and the trophy when the night ends. Without this its
      // cache stays "fresh" for two minutes, so walking to Stats after a match
      // showed last week's numbers until a hard refresh. `['boards']` is a
      // prefix of every board's own key, so this covers the list and each one.
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
    },
    [id, queryClient],
  )

  /**
   * A rejected batch means the local bracket and the server's disagree.
   *
   * The server applies a run all-or-nothing, so nothing was written. Refetching
   * is the honest resolution: whatever the host saw locally was wrong, and
   * guessing which entry caused it would be worse than showing the truth.
   */
  const onBatchError = useCallback(
    (error) => {
      setSyncError(error?.message ?? 'Some results could not be saved.')
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
    },
    [id, queryClient],
  )

  const { enqueue, flush } = useReportQueue({
    tournamentId: id,
    delay: 3_000,
    onFlush: sendBatch,
    onError: onBatchError,
    // 'saved' only once something was actually pending: arriving at a finished
    // bracket and touching nothing should not claim credit for a save that
    // never happened.
    onPendingChange: (pending) =>
      setSaveState((current) => (pending ? 'saving' : current === 'saving' ? 'saved' : current)),
  })

  /** Move the bracket now, and queue the result to be sent with its neighbours. */
  const report = (matchId, a, b) => {
    setSyncError(null)
    optimistically((matches) => applyResult(matches, matchId, a, b))
    enqueue({ match: matchId, op: 'report', score_a: a, score_b: b })
  }

  const clear = (matchId) => {
    setSyncError(null)
    optimistically((matches) => clearResult(matches, matchId))
    enqueue({ match: matchId, op: 'clear' })
  }

  // The last result of the night should not sit in a queue for three seconds while
  // the host looks at a finished bracket wondering whether it saved.
  const everyMatchDecided =
    tournament?.matches?.length > 0 && tournament.matches.every((m) => m.winner || !m.a || !m.b)

  // Only on the edge that *completes* the bracket. Firing on every change of
  // this flag also caught the opposite edge — undoing a result on a finished
  // bracket — which sent the write immediately instead of letting it batch,
  // and `sendBatch` replaces the cache with the server's reply. So an undo was
  // the one click whose outcome visibly waited on the network: it applied
  // instantly, then snapped to whatever came back a second later. Undoing goes
  // through the normal queue like every other click.
  const wasComplete = useRef(everyMatchDecided)

  useEffect(() => {
    if (everyMatchDecided && !wasComplete.current) flush()
    wasComplete.current = everyMatchDecided
  }, [everyMatchDecided, flush])

  const start = useMutation({
    mutationFn: () => tournamentsApi.start(id),
    onSuccess: refreshAll,
  })

  const nextRound = useMutation({
    mutationFn: () => tournamentsApi.nextRound(id),
    onSuccess: refresh,
  })

  /**
   * Rename the tournament.
   *
   * Written to the cache first so the header changes on Enter. The list behind
   * it shows the same title, and the URL carries it as a readable tail, so both
   * are refreshed once the server confirms.
   */
  const rename = useMutation({
    mutationFn: (title) => tournamentsApi.update(id, { title }),
    onMutate: (title) => {
      const key = queryKeys.tournaments.detail(id)
      const previous = queryClient.getQueryData(key)
      if (previous) queryClient.setQueryData(key, { ...previous, title })
      return { previous }
    },
    onError: (error, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tournaments.detail(id), context.previous)
      }
      setSyncError(error.message)
    },
    onSuccess: refreshAll,
  })

  const addCohost = useMutation({
    mutationFn: (userId) => tournamentsApi.addCohost(id, userId),
    onSuccess: refresh,
    onError: (error) => setSyncError(error.message),
  })

  const removeCohost = useMutation({
    mutationFn: (userId) => tournamentsApi.removeCohost(id, userId),
    onSuccess: refresh,
    onError: (error) => setSyncError(error.message),
  })

  if (isLoading) return <SkeletonPage width="max-w-[92rem]" />

  if (!tournament) {
    return (
      <PageShell width="wide" className="glass-backdrop">
        <EmptyState
          title="Tournament not found"
          description="It may have been deleted, or the link may be wrong."
          actionLabel="Back to tournaments"
          actionTo={paths.tournaments}
        />
      </PageShell>
    )
  }

  const isList = LIST_FORMATS.has(tournament.format)
  const canReport = tournament.can_report

  /**
   * The account that actually built this bracket.
   *
   * Deliberately not `is_host`, which is also true for a co-host with a host
   * role and for the owner of the group it belongs to. Granting permission is
   * the creator's alone: someone handed the right to report results should not
   * be able to hand it onward, or the creator could end up with helpers they
   * never chose.
   */
  const isCreator = Boolean(user?.id && tournament.created_by?.id === user.id)
  const spectatorUrl = `${window.location.origin}${paths.spectate(
    tournament.public_slug,
    tournament.title,
  )}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(spectatorUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied; the link is visible in the field
      // beside the button either way.
    }
  }

  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <EditableTitle
            title={tournament.title}
            canEdit={Boolean(tournament.is_host)}
            onSave={(title) => rename.mutate(title)}
            pending={rename.isPending}
          />
          <p className="text-base-content/60 mt-1 text-sm">
            {FORMAT_LABELS[tournament.format] ?? tournament.format} · {tournament.entrants.length}{' '}
            entrants
            <span
              className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                tournament.state === 'active'
                  ? 'bg-success/15 text-success'
                  : 'bg-base-content/8 text-base-content/60'
              }`}
            >
              {tournament.state === 'active' && (
                <span className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />
              )}
              {tournament.state}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sits with the other header controls rather than above the bracket:
              it answers "is the night recorded?", which is a question about
              this tournament, not about the page. */}
          <SaveIndicator state={syncError ? 'idle' : saveState} />

          {isCreator && (
            <CohostManager
              cohosts={tournament.roles ?? []}
              creatorId={tournament.created_by?.id}
              onAdd={(userId) => addCohost.mutate(userId)}
              onRemove={(userId) => removeCohost.mutate(userId)}
              pending={addCohost.isPending || removeCohost.isPending}
            />
          )}

          {tournament.is_host && tournament.state === 'draft' && (
            <button
              className="group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              onClick={() => start.mutate()}
              disabled={start.isPending}
            >
              <Play className="h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-110" />
              Start
            </button>
          )}

          {tournament.is_host && isList && tournament.state === 'active' && (
            <button
              className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 items-center rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              onClick={() => nextRound.mutate()}
              disabled={nextRound.isPending}
            >
              Next round
            </button>
          )}

          <button
            className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98]"
            onClick={copyLink}
            title="Copy a read-only link anyone can open without an account"
          >
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Share'}
          </button>
        </div>
      </div>

      {tournament.description && (
        <p className="text-base-content/70 mb-6 text-sm">{tournament.description}</p>
      )}

      {(syncError || start.isError || nextRound.isError) && (
        <div
          role="alert"
          className="border-error/30 bg-error/12 text-error mb-4 rounded-xl border px-3 py-2 text-sm"
        >
          {syncError ?? (start.error || nextRound.error).message}
        </div>
      )}

      {!canReport && tournament.state !== 'draft' && (
        <div className="glass-inset mb-6 px-3 py-2 text-sm">
          You're viewing this as a spectator. Only the host and co-hosts can report results.
        </div>
      )}

      {/* The bracket takes the full width. Standings used to hold a 16rem
          column beside it, which cost the bracket a whole round of horizontal
          room on a laptop — and standings are what you read after a result,
          not while clicking one. They now sit below, next to the entrants. */}
      <div className={`grid gap-6 ${tournament.rules ? 'lg:grid-cols-[1fr_18rem]' : ''}`}>
        <div className="min-w-0">
          {tournament.matches.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No bracket yet"
              description="This tournament has entrants but no matches. Generate the bracket to get started."
            />
          ) : isList ? (
            <RoundList
              matches={tournament.matches}
              canReport={canReport}
              onReport={(matchId, side) => {
                const score = resolveClick(matchId, side)
                if (score) report(matchId, score.a, score.b)
              }}
              onClear={(matchId) => clear(matchId)}
            />
          ) : (
            <BracketView
              matches={tournament.matches}
              canReport={canReport}
              onReport={(matchId, side) => {
                const score = resolveClick(matchId, side)
                if (score) report(matchId, score.a, score.b)
              }}
              onClear={(matchId) => clear(matchId)}
            />
          )}
        </div>

        {/* Rules only. The spectator link lives on the Share button now —
            a permanent card for a URL nobody reads was dead weight. */}
        {tournament.rules && (
          <aside>
            <div className="glass-panel">
              <div className="p-4">
                <h3 className="mb-1 text-sm font-semibold">Rules</h3>
                <p className="text-base-content/70 text-xs whitespace-pre-wrap">
                  {tournament.rules}
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Standings and the roster share the bottom row: both are things you
          read once the bracket has moved, and side by side they fill the width
          that a single full-bleed list would waste. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Trophy className="text-accent h-5 w-5" />
            Standings
          </h2>
          <p className="text-base-content/60 mb-4 text-sm">How everyone is placed so far.</p>

          <div className="glass-panel">
            <div className="p-4">
              <StandingsTable rows={standings} />
            </div>
          </div>
        </section>

        <EntrantRoster entrants={tournament.entrants} />
      </div>
    </PageShell>
  )
}
