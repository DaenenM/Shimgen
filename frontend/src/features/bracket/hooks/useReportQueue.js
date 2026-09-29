import { useCallback, useEffect, useRef } from 'react'

/**
 * Where a tournament's unsent results wait between page loads.
 *
 * Namespaced per tournament so two brackets open in two tabs cannot inherit
 * each other's queue.
 */
const storageKey = (id) => `shimgen:pending-results:${id}`

/**
 * Read back whatever the last session left unsent.
 *
 * Anything unreadable is discarded rather than repaired: a corrupt queue would
 * be replayed against a live bracket, and dropping it costs at most the last
 * few clicks while keeping something wrong out of the tournament.
 */
function loadQueue(id) {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Shape-check each entry: this is replayed as an API payload, so a
    // half-written record is worse than none.
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
    // A full or blocked store is not worth failing a click over. The in-memory
    // queue still works; only the crash-recovery guarantee is lost.
  }
}

/**
 * Collect reported results and send them in one request.
 *
 * A host clicking through a round used to mean one request per click. The
 * bracket already moves on the click — the cache is written optimistically —
 * so the request is only durability, and durability can wait a few seconds and
 * travel with its neighbours.
 *
 * The queue is a list, not a map: two clicks on one match are two entries, and
 * the server replays them in order. That is what lets a mis-click and its
 * correction both be sent without the client deciding which one wins.
 *
 * What is deliberately NOT deferred: anything that would lose work. The queue
 * flushes early when the tab closes, when it is hidden, when the network drops,
 * and on demand — see `flush`. The delay is a batching window, not a buffer the
 * user can lose a night's results in.
 *
 * The window earns more than it used to. One flush is one `batch-report`, which
 * recomputes a linked stats board from scratch, re-reads the bracket with nine
 * prefetches and serialises the whole detail payload — and since live updates
 * landed it also fans out to every viewer, each of whom refetches that payload.
 * Eight clicks batched are one broadcast and N refetches; eight clicks sent
 * separately are eight broadcasts and 8N. `inFlight` also means unbatched
 * clicks queue behind each other rather than going in parallel, so a shorter
 * window trades throughput for latency rather than buying both.
 */
export function useReportQueue({ tournamentId, delay = 3_000, onFlush, onError, onPendingChange }) {
  const queue = useRef([])
  const timer = useRef(null)
  const inFlight = useRef(false)

  // Kept in refs so the callbacks below stay stable across renders — a new
  // `flush` every render would re-run the effect that binds the unload
  // listeners, and rebinding them on every click is how they end up missing at
  // the moment they matter.
  const handlers = useRef({ onFlush, onError, onPendingChange, tournamentId })
  useEffect(() => {
    handlers.current = { onFlush, onError, onPendingChange, tournamentId }
  })

  /**
   * Record the queue and tell the page whether anything is still unsent.
   *
   * Mirrored to localStorage on every change. The unload handlers below start a
   * flush, but the browser does not wait for an in-flight request before tearing
   * the page down — so a close or refresh mid-batch can lose what it looked like
   * it was saving. Writing synchronously means the next visit finds the results
   * and sends them, and a crash or a killed tab is covered by the same path.
   *
   * Reads the id from the handler ref rather than closing over it, so the
   * callbacks below stay stable and can never write to a previous bracket's key.
   */
  const announce = useCallback(() => {
    const id = handlers.current.tournamentId
    if (id != null) saveQueue(id, queue.current)
    handlers.current.onPendingChange?.(queue.current.length > 0 || inFlight.current)
  }, [])

  const flush = useCallback(async () => {
    if (inFlight.current || queue.current.length === 0) return

    clearTimeout(timer.current)
    timer.current = null

    // Taken before the await, so clicks during the request join the next batch
    // rather than being dropped by the splice that follows it.
    const sending = queue.current
    queue.current = []
    inFlight.current = true
    announce()

    try {
      await handlers.current.onFlush?.(sending)
    } catch (error) {
      // A 4xx is the server refusing this batch on its merits — an impossible
      // score, a match that no longer exists. Retrying cannot fix it, and with
      // the queue persisted it would be replayed on every future visit, each
      // time knocking the bracket back. Drop it and let the refetch that the
      // error handler triggers show what the server actually holds.
      //
      // Anything else — offline, a timeout, a 500 — is worth keeping. Those go
      // back at the front, because they happened before whatever was queued
      // while this was in flight and order is what the server replays.
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

      // Restarted on each click: the window is "three seconds after the host stops
      // clicking", so a run of results goes as one request rather than the
      // first one dragging the rest along early.
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [announce, delay, flush],
  )

  /**
   * Send whatever the last session left behind.
   *
   * Runs once the bracket is known to be loadable, so a queue is never replayed
   * against a tournament the user can no longer report to. Anything already
   * applied server-side is harmless to resend: reporting the same score twice
   * is a correction to the same value, and the server treats a repeat as an
   * overwrite rather than an append.
   */
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
    // `visibilitychange` is the one that actually fires on mobile — a tab
    // switch or a locked phone never reaches `beforeunload`, and iOS may kill
    // the page from there without another event.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    // Losing the connection means the next flush would fail anyway; going now
    // at least catches the case where it is still half up.
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
      // Unmounting is navigating away from the bracket, which must not silently
      // drop what has not gone yet.
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
