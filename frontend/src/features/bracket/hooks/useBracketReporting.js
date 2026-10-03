import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { applyResult, clearResult, scoreForClick } from '../utils/optimistic'
import { useReportQueue } from './useReportQueue'
import { useTournamentSocket } from './useTournamentSocket'

// Reports results on a live bracket. Used by TournamentDetailPage.jsx.
// Clicks update the cached bracket immediately and queue the result; the queue
// sends batches. Also listens for other devices' reports via socket, unless
// this device has unsent clicks of its own.
export function useBracketReporting(id, tournament) {
  const queryClient = useQueryClient()
  // Set when a flush is rejected, so the host is told instead of the bracket
  // silently snapping back to the server's version.
  const [syncError, setSyncError] = useState(null)
  // 'idle' | 'saving' | 'saved'. Stays 'saved' for the rest of the visit once reached.
  const [saveState, setSaveState] = useState('idle')

  // Writes a change to the cache immediately (before the request completes),
  // so the click moves the bracket with no visible pause; onSettled reconciles
  // anything this simplified local copy of the advancement rules got wrong.
  const optimistically = (transform) => {
    const key = queryKeys.tournaments.detail(id)

    // Written synchronously, before cancelQueries — awaiting that first would
    // stall the click on an in-flight request aborting.
    const previous = queryClient.getQueryData(key)
    if (previous) {
      queryClient.setQueryData(key, {
        ...previous,
        matches: transform(previous.matches),
      })
    }

    // Stops any in-flight refetch landing on top of the local edit (not awaited).
    queryClient.cancelQueries({ queryKey: key })

    return { previous }
  }

  // Reads the score from the cache (not rendered props), so rapid clicks on
  // one series each see what the previous click just wrote.
  const resolveClick = (matchId, side) => {
    const cached = queryClient.getQueryData(queryKeys.tournaments.detail(id))
    return scoreForClick(
      cached?.matches?.find((m) => m.id === matchId),
      side,
    )
  }

  // Sends queued results as one request; the response replaces the cache
  // outright (write + reconcile in one), so nothing needs refetching after.
  const sendBatch = useCallback(
    async (operations) => {
      const fresh = await tournamentsApi.batchReport(id, operations)
      queryClient.setQueryData(queryKeys.tournaments.detail(id), fresh)
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
      // A linked board is updated server-side by the same request; invalidate
      // its cache too or it shows stale numbers for up to 2 minutes.
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
    },
    [id, queryClient],
  )

  // The server applies a batch all-or-nothing, so a rejection means nothing
  // was written — refetch to show the true state rather than guess what failed.
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
    // Only mark 'saved' if something was actually pending — visiting a
    // finished bracket untouched shouldn't claim a save that never happened.
    onPendingChange: (pending) =>
      setSaveState((current) => (pending ? 'saving' : current === 'saving' ? 'saved' : current)),
  })

  // Refetches when another device reports a result (the socket sends a bare
  // nudge, not the data, so each viewer refetches with their own permissions).
  // Skipped while this device has unsent clicks — the reporter's own broadcast
  // would otherwise overwrite their optimistic bracket with a stale server copy.
  useTournamentSocket(id, () => {
    if (hasPending()) return
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
  })

  // Moves the bracket now, queues the result to send with its neighbours.
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

  // Flush immediately when the bracket completes, rather than leaving the
  // final result sitting in the queue for 3 seconds.
  const everyMatchDecided =
    tournament?.matches?.length > 0 && tournament.matches.every((m) => m.winner || !m.a || !m.b)

  // Only fires on the edge that completes the bracket, not on undoing a result
  // afterwards — undoing stays on the normal batched queue.
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
