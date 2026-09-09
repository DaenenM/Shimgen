import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Play, Share2, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { matches as matchesApi, tournaments as tournamentsApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/PageLoader'
import { BracketView } from '@/features/bracket/BracketView'
import { EntrantRoster } from '@/features/bracket/EntrantRoster'
import { RoundList } from '@/features/bracket/RoundList'
import { StandingsTable } from '@/features/bracket/StandingsTable'
import { FORMAT_LABELS } from '@/features/bracket/layout'
import { applyResult, clearResult } from '@/features/bracket/optimistic'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
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
  const [copied, setCopied] = useState(false)

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
  }

  /**
   * Reconcile after a reported result, without making the page feel busy.
   *
   * The optimistic write has already put the right thing on screen, so this is
   * only checking the client's copy of the advancement rules against the
   * server's. Debounced because a host reports several matches in a row — four
   * clicks used to mean four full refetches, and the page spent most of a
   * second visibly settling after each one.
   */
  const reconcile = useDebouncedCallback(refresh, 400)

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

  const rollback = (_error, _variables, context) => {
    if (context?.previous) {
      queryClient.setQueryData(queryKeys.tournaments.detail(id), context.previous)
    }
  }

  const report = useMutation({
    mutationFn: ({ matchId, a, b }) => matchesApi.report(matchId, a, b),
    onMutate: ({ matchId, a, b }) => {
      return optimistically((matches) => applyResult(matches, matchId, a, b))
    },
    onError: rollback,
    onSettled: reconcile,
  })

  const clear = useMutation({
    mutationFn: (matchId) => matchesApi.clear(matchId),
    onMutate: (matchId) => {
      return optimistically((matches) => clearResult(matches, matchId))
    },
    onError: rollback,
    onSettled: reconcile,
  })

  const start = useMutation({
    mutationFn: () => tournamentsApi.start(id),
    onSuccess: refreshAll,
  })

  const nextRound = useMutation({
    mutationFn: () => tournamentsApi.nextRound(id),
    onSuccess: refresh,
  })

  if (isLoading) return <PageLoader label="Loading bracket…" />

  if (!tournament) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          title="Tournament not found"
          description="It may have been deleted, or the link may be wrong."
          actionLabel="Back to tournaments"
          actionTo={paths.tournaments}
        />
      </div>
    )
  }

  const isList = LIST_FORMATS.has(tournament.format)
  const canReport = tournament.can_report
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
    <div className="mx-auto max-w-[92rem] px-4 py-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tournament.title || 'Untitled tournament'}
          </h1>
          <p className="text-base-content/60 mt-1 text-sm">
            {FORMAT_LABELS[tournament.format] ?? tournament.format} · {tournament.entrants.length}{' '}
            entrants
            <span
              className={`badge badge-sm ml-2 ${
                tournament.state === 'complete'
                  ? 'badge-success'
                  : tournament.state === 'active'
                    ? 'badge-primary'
                    : 'badge-ghost'
              }`}
            >
              {tournament.state}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tournament.is_host && tournament.state === 'draft' && (
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => start.mutate()}
              disabled={start.isPending}
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          )}

          {tournament.is_host && isList && tournament.state === 'active' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => nextRound.mutate()}
              disabled={nextRound.isPending}
            >
              Next round
            </button>
          )}

          <button
            className="btn btn-outline btn-sm gap-2"
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

      {(report.isError || clear.isError || start.isError || nextRound.isError) && (
        <div role="alert" className="alert alert-error mb-4 py-2 text-sm">
          {(report.error || clear.error || start.error || nextRound.error).message}
        </div>
      )}

      {!canReport && tournament.state !== 'draft' && (
        <div className="alert bg-base-100 border-base-300 mb-6 border py-2 text-sm">
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
              onReport={(matchId, a, b) => report.mutate({ matchId, a, b })}
              onClear={(matchId) => clear.mutate(matchId)}
            />
          ) : (
            <BracketView
              matches={tournament.matches}
              canReport={canReport}
              onReport={(matchId, a, b) => report.mutate({ matchId, a, b })}
              onClear={(matchId) => clear.mutate(matchId)}
            />
          )}
        </div>

        {/* Rules only. The spectator link lives on the Share button now —
            a permanent card for a URL nobody reads was dead weight. */}
        {tournament.rules && (
          <aside>
            <div className="card bg-base-100 border-base-300 border">
              <div className="card-body p-4">
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
            <Trophy className="h-5 w-5" />
            Standings
          </h2>
          <p className="text-base-content/60 mb-4 text-sm">How everyone is placed so far.</p>

          <div className="card bg-base-100 border-base-300 border">
            <div className="card-body p-4">
              <StandingsTable rows={standings} />
            </div>
          </div>
        </section>

        <EntrantRoster entrants={tournament.entrants} />
      </div>
    </div>
  )
}
