// Applies/clears a match result locally, mirroring backend/apps/tournaments/brackets/advance.py,
// so the bracket updates on click instead of waiting for a refetch.
// Used by useBracketReporting.js and useReportQueue.js.

// The name an entrant goes by, read off the match they came from (the only place the client holds labels).
function labelFor(source, entrantId) {
  if (source.a === entrantId) return source.a_label ?? null
  if (source.b === entrantId) return source.b_label ?? null
  return null
}

/** Which side of `target` an entrant arriving from `source` occupies. */
function slotFor(target, source, matches, { dropping }) {
  // A losers minor round can be fed by both a drop and a survivor at once; the drop always takes b.
  if (target.bracket === 'losers') {
    const fedByDrop = matches.some((m) => m.next_match_lose === target.id && m.bracket === 'main')
    const fedByWin = matches.some((m) => m.next_match_win === target.id && m.bracket === 'losers')
    if (fedByDrop && fedByWin) return dropping ? 'b' : 'a'
  }

  // Grand final: undefeated side in a, losers side in b.
  if (target.bracket === 'final') {
    return dropping || source.bracket === 'losers' ? 'b' : 'a'
  }

  return source.position % 2 === 0 ? 'a' : 'b'
}

/**
 * Return a new match list with `matchId` decided and both sides advanced.
 * Pure, for use as a React Query optimistic cache write.
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

  // Unfinished series: record the score, advance nobody.
  if (!resolved) return next

  // Grand final decides the tournament rather than feeding a next round.
  // Mirrors _resolve_grand_final on the backend.
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

    // Label travels with the id so the next round shows the name, not TBD.
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
 * Mirrors `_cascade_byes` in backend/apps/tournaments/brackets/advance.py — a bracket
 * with several byes chains two walkovers in a row (e.g. 5-entrant double elimination).
 * Mutates `matches` in place (already a fresh array from `applyResult`).
 */
function cascadeByes(matches, startIds) {
  // Queue rather than single pass: a walkover can feed another walkover.
  // `visited` guards a malformed graph with a cycle.
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

    // Only advance once nothing further can arrive.
    if (!feedersSettled(matches, target)) continue

    const present = target.a ?? target.b

    // `present` can legitimately be null (both feeders were walkovers with no loser);
    // the cascade must continue past it.
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
 * A feeder counts as settled once it has a winner, including a winners-bracket walkover
 * (winner but no loser), whose drop edge will never deliver anybody.
 */
function feedersSettled(matches, match) {
  const feeders = matches.filter(
    (m) => m.next_match_win === match.id || m.next_match_lose === match.id,
  )

  if (feeders.length === 0) return false

  return feeders.every((feeder) => {
    if (feeder.winner) return true
    // A phantom match (its own feeders were all byes) never gets a winner but is finished.
    return !feeder.a && !feeder.b && feedersSettled(matches, feeder)
  })
}

/**
 * Turn "this side won a game" into the score to post.
 * Split out from the card because two quick clicks on one series would otherwise both
 * read the pre-click score and post the same 1-0. Caller passes the freshest cached match.
 * Returns null when there is nothing sensible to send.
 */
export function scoreForClick(match, side) {
  if (!match || (side !== 'a' && side !== 'b')) return null

  const needed = match.wins_needed
  const sideEntrant = side === 'a' ? match.a : match.b
  if (!sideEntrant) return null

  // Clicking the loser of a decided match is a correction: hand the win straight over.
  if (match.winner && match.winner !== sideEntrant) {
    return side === 'a' ? { a: needed, b: 0 } : { a: 0, b: needed }
  }

  const score = match.score ?? {}
  const mine = score[side] ?? 0
  const theirs = score[side === 'a' ? 'b' : 'a'] ?? 0

  // One past the threshold wraps back to zero, resetting the whole series.
  const next = mine >= needed ? 0 : mine + 1
  const other = next === 0 ? 0 : theirs

  return side === 'a' ? { a: next, b: other } : { a: other, b: next }
}

/** Return a new match list with `matchId` cleared back to unplayed. */
export function clearResult(matches, matchId) {
  const match = matches.find((m) => m.id === matchId)
  if (!match) return matches

  const next = matches.map((m) => (m.id === matchId ? { ...m, score: {}, winner: null } : m))

  // Grand final's decider is not a win/lose edge to walk back — mirrors
  // _retract in backend/apps/tournaments/brackets/advance.py.
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

  // Pull both entrants back out of wherever this match sent them, and keep going —
  // mirrors the recursion in `_retract` on the backend.
  unseat(next, match, match.next_match_win, false)
  unseat(next, match, match.next_match_lose, true)

  // Retracting can leave a match fed only by a bye, which the backend re-resolves.
  cascadeByes(next, [match.next_match_win, match.next_match_lose])

  return next
}

/**
 * Remove whoever `source` sent into `target`, and unwind anything they won.
 * Recursive: clearing a result the entrant went on to win would otherwise leave
 * them standing in the round after it. Mirrors the backend calling `clear_result`
 * on the target inside `_retract`.
 * `seen` keys on the edge (target + slot), not just the target id, because the grand
 * final and losers final are each reached twice — once per seat.
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

  // Only the seat this retraction owns.
  if (target[slot] === null || target[slot] === undefined) return

  // Walk this match's own edges back first, while it still knows who won and where they went.
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
