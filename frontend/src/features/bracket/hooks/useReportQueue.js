import { useCallback, useEffect, useRef } from 'react'

// Batches reported match results into one request instead of one per click.
// Used by useBracketReporting.js.

/** Where a tournament's unsent results wait between page loads, namespaced per tournament. */
const storageKey = (id) => `shimgen:pending-results:${id}`

/** Read back whatever the last session left unsent. Anything unreadable is discarded, not repaired. */
function loadQueue(id) {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Shape-check each entry: it gets replayed as an API payload.
    return parsed.filter(
      (op) =>
        op &&
        typeof op.match === 'number' &&
        (op.op === 'clear' ||
          (op.op === 'report' && typeof op.score_a === 'number' && typeof op.score_b === 'number')),
    )
  } catch {
    return []
  }
}

/** Persist the queue, or clear the key once it is empty. */
function saveQueue(id, operations) {
  try {
    if (operations.length === 0) localStorage.removeItem(storageKey(id))
    else localStorage.setItem(storageKey(id), JSON.stringify(operations))
  } catch {
    // Full or blocked storage isn't worth failing a click over; only crash-recovery is lost.
  }
}

/**
 * Collect reported results and send them in one request after `delay` ms of inactivity.
 * A list, not a map — two clicks on one match are two entries, replayed in order by the server.
 * Flushes early on tab close/hide/offline/unmount so nothing queued is ever lost, only delayed.
 */
export function useReportQueue({ tournamentId, delay = 3_000, onFlush, onError, onPendingChange }) {
  const queue = useRef([])
  const timer = useRef(null)
  const inFlight = useRef(false)

  // Refs so the callbacks below stay stable across renders (otherwise the unload
  // listeners below would need to be rebound on every click).
  const handlers = useRef({ onFlush, onError, onPendingChange, tournamentId })
  useEffect(() => {
    handlers.current = { onFlush, onError, onPendingChange, tournamentId }
  })

  /** Mirror the queue to localStorage and report whether anything is unsent. */
  const announce = useCallback(() => {
    const id = handlers.current.tournamentId
    if (id != null) saveQueue(id, queue.current)
    handlers.current.onPendingChange?.(queue.current.length > 0 || inFlight.current)
  }, [])

  const flush = useCallback(async () => {
    if (inFlight.current || queue.current.length === 0) return

    clearTimeout(timer.current)
    timer.current = null

    // Taken before the await so clicks during the request join the next batch.
    const sending = queue.current
    queue.current = []
    inFlight.current = true
    announce()

    try {
      await handlers.current.onFlush?.(sending)
    } catch (error) {
      // A 4xx is the server refusing this batch on its merits; retrying can't fix it
      // and would replay forever. Anything else (offline, timeout, 500) goes back at
      // the front, ahead of whatever queued while this was in flight.
      const permanent = error?.status >= 400 && error?.status < 500

      if (!permanent) queue.current = [...sending, ...queue.current]

      handlers.current.onError?.(error, sending)
    } finally {
      inFlight.current = false
      announce()
    }
  }, [announce])

  const enqueue = useCallback(
    (operation) => {
      queue.current.push(operation)
      announce()

      // Restarted on each click so a run of results goes as one request.
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [announce, delay, flush],
  )

  /** Send whatever the last session left behind, once the bracket is known loadable. */
  const recovered = useRef(false)

  useEffect(() => {
    if (recovered.current || tournamentId == null) return
    recovered.current = true

    const waiting = loadQueue(tournamentId)
    if (waiting.length === 0) return

    queue.current = [...waiting, ...queue.current]
    announce()
    flush()
  }, [tournamentId, announce, flush])

  useEffect(() => {
    // visibilitychange fires reliably on mobile; beforeunload often doesn't.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    const onOffline = () => flush()

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    window.addEventListener('offline', onOffline)

    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('offline', onOffline)
      clearTimeout(timer.current)
      flush()
    }
  }, [flush])

  return {
    enqueue,
    flush,
    /** Whether anything is waiting to be sent, for an "unsaved" indicator. */
    hasPending: () => queue.current.length > 0 || inFlight.current,
  }
}
