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

  return next
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

  // Pull both entrants back out of wherever this match sent them. Not
  // recursive: a downstream result the server will also clear is rare enough
  // that letting the refetch handle it beats duplicating that logic here.
  const unseat = (targetId, dropping) => {
    if (!targetId) return

    const index = next.findIndex((m) => m.id === targetId)
    if (index === -1) return

    const slot = slotFor(next[index], match, next, { dropping })
    // The label goes with the id, or the emptied slot keeps showing a name.
    next[index] = {
      ...next[index],
      [slot]: null,
      [`${slot}_label`]: null,
      winner: null,
      score: {},
    }
  }

  unseat(match.next_match_win, false)
  unseat(match.next_match_lose, true)

  return next
}
