import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { applyResult, clearResult, scoreForClick } from '../utils/optimistic'
import { useReportQueue } from './useReportQueue'
import { useTournamentSocket } from './useTournamentSocket'

/**
 * Reporting results on a live bracket.
 *
 * Clicks move the cached bracket immediately and queue the result; the queue
 * sends runs of results as one batch. Also listens for other devices' reports
 * and pulls their changes in, unless this device has clicks still unsent.
 */
export function useBracketReporting(id, tournament) {
  const queryClient = useQueryClient()
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

  const { enqueue, flush, hasPending } = useReportQueue({
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

  /**
   * Somebody else changed this bracket — pull the new version.
   *
   * The server sends a bare nudge rather than the data, so each viewer refetches
   * through their own query and gets the serialization their own account is
   * entitled to. This is what fixes a co-host reporting on their phone while the
   * host's laptop shows the old bracket until they navigate away and back.
   *
   * Skipped entirely while this device has unsent clicks. The broadcast the
   * reporter triggers comes back to them too, and refetching then would replace
   * their optimistic bracket with a server version that does not yet contain the
   * results still sitting in the queue — the bracket would visibly jump
   * backwards mid-run. Their own flush already writes the reconciled bracket, so
   * nothing is missed by waiting.
   */
  useTournamentSocket(id, () => {
    if (hasPending()) return
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.standings(id) })
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

  const onReport = (matchId, side) => {
    const score = resolveClick(matchId, side)
    if (score) report(matchId, score.a, score.b)
  }

  return { syncError, saveState, onReport, onClear: clear }
}
