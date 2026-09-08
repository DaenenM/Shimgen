/**
 * Applying a result locally, before the server answers.
 *
 * Clicking a name used to wait on two sequential requests — report, then
 * refetch the whole tournament — so the bracket sat still for a beat every
 * time. Running the same advancement rules in the browser lets the UI move on
 * the click and reconcile when the response lands.
 *
 * This deliberately mirrors backend/apps/tournaments/brackets/advance.py rather
 * than reimplementing it: same edges, same slot rules. It only has to be right
 * for the instant before the server's answer replaces it, so it handles the
 * common path and lets the refetch correct anything subtler.
 */

/** Which side of `target` an entrant arriving from `source` occupies. */
function slotFor(target, source, matches, { dropping }) {
  // A losers-bracket minor round takes one survivor and one fresh drop, and
  // both feeders can sit at the same position — so the drop always takes b.
  if (target.bracket === 'losers') {
    const fedByDrop = matches.some((m) => m.next_match_lose === target.id && m.bracket === 'main')
    const fedByWin = matches.some((m) => m.next_match_win === target.id && m.bracket === 'losers')
    if (fedByDrop && fedByWin) return dropping ? 'b' : 'a'
  }

  // The grand final seats the undefeated side in a, the losers side in b.
  if (target.bracket === 'final') {
    return dropping || source.bracket === 'losers' ? 'b' : 'a'
  }

  return source.position % 2 === 0 ? 'a' : 'b'
}

/**
 * Return a new match list with `matchId` decided and both sides advanced.
 *
 * Pure: the caller hands it the current list and gets a new one back, which is
 * what React Query wants for an optimistic cache write.
 */
export function applyResult(matches, matchId, scoreA, scoreB) {
  const match = matches.find((m) => m.id === matchId)
  if (!match) return matches

  const needed = Math.floor(match.best_of / 2) + 1
  const resolved = scoreA === needed || scoreB === needed

  const winnerId = scoreA === needed ? match.a : scoreB === needed ? match.b : null
  const loserId = scoreA === needed ? match.b : scoreB === needed ? match.a : null

  const next = matches.map((m) =>
    m.id === matchId ? { ...m, score: { a: scoreA, b: scoreB }, winner: winnerId } : m,
  )

  // An unfinished series records the running score and advances nobody.
  if (!resolved) return next

  const seat = (targetId, entrantId, dropping) => {
    if (!targetId || !entrantId) return

    const index = next.findIndex((m) => m.id === targetId)
    if (index === -1) return

    const slot = slotFor(next[index], match, next, { dropping })
    next[index] = { ...next[index], [slot]: entrantId }
  }

  seat(match.next_match_win, winnerId, false)
  seat(match.next_match_lose, loserId, true)

  return next
}

/** Return a new match list with `matchId` cleared back to unplayed. */
export function clearResult(matches, matchId) {
  const match = matches.find((m) => m.id === matchId)
  if (!match) return matches

  const next = matches.map((m) => (m.id === matchId ? { ...m, score: {}, winner: null } : m))

  // Pull both entrants back out of wherever this match sent them. Not
  // recursive: a downstream result the server will also clear is rare enough
  // that letting the refetch handle it beats duplicating that logic here.
  const unseat = (targetId, dropping) => {
    if (!targetId) return

    const index = next.findIndex((m) => m.id === targetId)
    if (index === -1) return

    const slot = slotFor(next[index], match, next, { dropping })
    next[index] = { ...next[index], [slot]: null, winner: null, score: {} }
  }

  unseat(match.next_match_win, false)
  unseat(match.next_match_lose, true)

  return next
}
