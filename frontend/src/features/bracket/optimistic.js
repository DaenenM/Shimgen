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

/**
 * The name an entrant goes by, read off the match they came from.
 *
 * The match list is the only place the client holds labels — there is no
 * separate entrant lookup in this shape — so the source match is where the
 * winner's own name lives.
 */
function labelFor(source, entrantId) {
  if (source.a === entrantId) return source.a_label ?? null
  if (source.b === entrantId) return source.b_label ?? null
  return null
}

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

  // The grand final decides the tournament rather than feeding a next round.
  // Its decider is seated with both entrants only when the losers finalist
  // wins — the undefeated side taking it ends things, and the decider stays
  // empty. Mirrors _resolve_grand_final on the backend.
  if (match.bracket === 'final' && match.next_match_win) {
    const index = next.findIndex((m) => m.id === match.next_match_win)
    if (index !== -1) {
      // `a` is always the undefeated side.
      const losersFinalistWon = winnerId === match.b
      next[index] = losersFinalistWon
        ? {
            ...next[index],
            a: match.a,
            b: match.b,
            a_label: match.a_label ?? null,
            b_label: match.b_label ?? null,
          }
        : {
            ...next[index],
            a: null,
            b: null,
            a_label: null,
            b_label: null,
            winner: null,
            score: {},
          }
    }
    return next
  }

  const seat = (targetId, entrantId, dropping) => {
    if (!targetId || !entrantId) return

    const index = next.findIndex((m) => m.id === targetId)
    if (index === -1) return

    const slot = slotFor(next[index], match, next, { dropping })

    // The label travels with the id. The card renders `a_label`, not `a`, so
    // seating the id alone advanced the entrant invisibly: the next round kept
    // reading TBD until the server answered with the name filled in, which is
    // exactly the delay the optimistic write exists to avoid.
    next[index] = {
      ...next[index],
      [slot]: entrantId,
      [`${slot}_label`]: labelFor(match, entrantId),
    }
  }

  seat(match.next_match_win, winnerId, false)
  seat(match.next_match_lose, loserId, true)

  cascadeByes(next, [match.next_match_win, match.next_match_lose])

  return next
}

/**
 * Walk entrants through matches that can never be contested.
 *
 * Mirrors `_cascade_byes` in backend/apps/tournaments/brackets/advance.py. With
 * several byes in one bracket an entrant is handed two walkovers in a row — a
 * 5-entrant double elimination does exactly this — and the server resolves that
 * chain the moment a result lands.
 *
 * Without it here the click moved only the match clicked and the one slot it
 * fed: everything further down stayed TBD until the batched save came back,
 * which is the "it waits for Saved to update" the optimistic write exists to
 * prevent. The clicked card moved instantly and the rest of the bracket lagged
 * behind it by a whole round trip.
 *
 * Mutates `matches` in place — it is already the fresh array `applyResult`
 * built, never the cached one.
 */
function cascadeByes(matches, startIds) {
  // A walkover can feed another walkover, so this is a queue rather than a
  // single pass. `visited` keeps a malformed graph with a cycle from spinning.
  const queue = [...startIds]
  const visited = new Set()

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || visited.has(id)) continue
    visited.add(id)

    const index = matches.findIndex((m) => m.id === id)
    if (index === -1) continue

    const target = matches[index]

    // Already decided, or genuinely playable: nothing to walk through.
    if (target.winner || (target.a && target.b)) continue

    // Only when nothing further can arrive. A feeder still to be played means
    // this slot is waiting for a real opponent, not standing empty forever.
    if (!feedersSettled(matches, target)) continue

    const present = target.a ?? target.b

    // `present` may legitimately be null: both feeders can be walkovers that
    // produce no loser at all. That match resolves to nobody, and the cascade
    // must continue past it or everything downstream stalls.
    if (present !== null && present !== undefined) {
      matches[index] = { ...target, winner: present }

      const winIndex = matches.findIndex((m) => m.id === target.next_match_win)
      if (winIndex !== -1) {
        const slot = slotFor(matches[winIndex], target, matches, { dropping: false })
        matches[winIndex] = {
          ...matches[winIndex],
          [slot]: present,
          [`${slot}_label`]: labelFor(target, present),
        }
      }
    }

    queue.push(target.next_match_win, target.next_match_lose)
  }
}

/**
 * Whether anything can still arrive in `match`.
 *
 * A feeder counts as settled once it has a winner — that covers the bye case,
 * where a winners-bracket walkover has a winner but no loser, so its drop edge
 * will never deliver anybody and the losers match it feeds must advance whoever
 * is already sitting there rather than waiting forever.
 */
function feedersSettled(matches, match) {
  const feeders = matches.filter(
    (m) => m.next_match_win === match.id || m.next_match_lose === match.id,
  )

  if (feeders.length === 0) return false

  return feeders.every((feeder) => {
    if (feeder.winner) return true
    // A phantom — a match whose own feeders were all byes — never gets a winner
    // but is nonetheless finished.
    return !feeder.a && !feeder.b && feedersSettled(matches, feeder)
  })
}

/**
 * Turn "this side won a game" into the score to post.
 *
 * Split out from the card because the card can only see the match React last
 * rendered with. Two quick clicks on one series both read the score from before
 * the first click, so both posted 1-0 and the second game was lost. The caller
 * passes the freshest cached match instead.
 *
 * Returns null when there is nothing sensible to send.
 */
export function scoreForClick(match, side) {
  if (!match || (side !== 'a' && side !== 'b')) return null

  const needed = match.wins_needed
  const sideEntrant = side === 'a' ? match.a : match.b
  if (!sideEntrant) return null

  // Clicking the loser of a decided match is a correction, not an increment:
  // hand the win straight over. Incrementing here would post a score both sides
  // had won, which the server rightly refuses.
  if (match.winner && match.winner !== sideEntrant) {
    return side === 'a' ? { a: needed, b: 0 } : { a: 0, b: needed }
  }

  const score = match.score ?? {}
  const mine = score[side] ?? 0
  const theirs = score[side === 'a' ? 'b' : 'a'] ?? 0

  // One past the threshold wraps back to zero, so an over-click on a Bo5 is not
  // stranded. Wrapping resets the whole series rather than leaving the loser's
  // games standing.
  const next = mine >= needed ? 0 : mine + 1
  const other = next === 0 ? 0 : theirs

  return side === 'a' ? { a: next, b: other } : { a: other, b: next }
}

/** Return a new match list with `matchId` cleared back to unplayed. */
export function clearResult(matches, matchId) {
  const match = matches.find((m) => m.id === matchId)
  if (!match) return matches

  const next = matches.map((m) => (m.id === matchId ? { ...m, score: {}, winner: null } : m))

  // The grand final seats its decider with both entrants at once — a bracket
  // reset replays the same pairing — so there is no win/lose edge to walk back.
  // Mirrors _retract in backend/apps/tournaments/brackets/advance.py.
  if (match.bracket === 'final' && match.next_match_win) {
    const index = next.findIndex((m) => m.id === match.next_match_win)
    if (index !== -1) {
      next[index] = {
        ...next[index],
        a: null,
        b: null,
        a_label: null,
        b_label: null,
        winner: null,
        score: {},
      }
    }
    return next
  }

  // Pull both entrants back out of wherever this match sent them, and keep
  // going: an entrant who won the next match too is standing in the one after
  // that. Mirrors the recursion in `_retract` on the backend.
  //
  // This used to stop at the two direct edges, which is what made an undo feel
  // like it waited on the server. Taking a quarterfinal win away emptied the
  // semifinal at once, but if that entrant had reached the final they stayed
  // there — and the losers-bracket side never unwound at all — until the
  // batched save came back and replaced the cache.
  unseat(next, match, match.next_match_win, false)
  unseat(next, match, match.next_match_lose, true)

  // Retracting can leave a match that is once again fed only by a bye, which
  // the backend re-resolves on its way out. Without this the bracket would
  // undo one round further than the server does.
  cascadeByes(next, [match.next_match_win, match.next_match_lose])

  return next
}

/**
 * Remove whoever `source` sent into `target`, and unwind anything they won.
 *
 * Recursive rather than a single step: clearing a result the entrant went on to
 * win would otherwise leave them standing in the round after it. The backend
 * does the same thing by calling `clear_result` on the target first, which
 * re-enters `_retract`.
 *
 * `seen` guards a malformed graph with a cycle. It keys on the *edge* rather
 * than the target, because a match is legitimately reached twice — once per
 * seat. The grand final takes the winners finalist along one edge and the
 * losers finalist along another, and the losers final likewise takes a drop and
 * a survivor. Keying on the target id let the first arrival clear one seat and
 * silently skip the second, which left an entrant standing in the losers final
 * and the grand final until the server's reply landed.
 */
function unseat(matches, source, targetId, dropping, seen = new Set()) {
  if (!targetId) return

  const index = matches.findIndex((m) => m.id === targetId)
  if (index === -1) return

  const target = matches[index]
  const slot = slotFor(target, source, matches, { dropping })

  const edge = `${target.id}:${slot}`
  if (seen.has(edge)) return
  seen.add(edge)

  // Only the seat this retraction owns, mirroring the `if getattr(target,
  // f"{slot}_id") is None: continue` guard in `_retract`. Blanking a seat
  // another feeder filled would delete a result the server keeps.
  if (target[slot] === null || target[slot] === undefined) return

  // Whatever this match decided is no longer decided, so walk its own edges
  // back first — while it still knows who won and where they went. This is the
  // `clear_result(target)` call inside `_retract`, and leaving it out is what
  // made an undo appear to wait on the server: the entrant stayed standing in
  // every round they had already won.
  if (target.winner) {
    unseat(matches, target, target.next_match_win, false, seen)
    unseat(matches, target, target.next_match_lose, true, seen)
  }

  // Re-read: the recursion above may have rewritten this entry.
  matches[index] = {
    ...matches[index],
    [slot]: null,
    [`${slot}_label`]: null,
    winner: null,
    score: {},
  }
}
