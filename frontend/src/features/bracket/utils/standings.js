// Standings computed from cached matches, so the table moves on click like the bracket.
// Mirrors backend tournaments/services/standings.py — keep the two in step.
// Used by useTournamentDetail.js and useSpectatorBracket.js.

const DEFAULT_POINTS = { win: 3, draw: 1, loss: 0 }
const BRACKET_RANK = { losers: 0, main: 1, final: 2 }
const SUPERSEDING = [0, 2]

const played = (m) => m.winner != null && m.a != null && m.b != null

// Lexicographic compare of equal-length number/bool arrays, like Python tuples.
function compare(x, y) {
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
  }
  return 0
}

const maxOf = (x, y) => (compare(x, y) >= 0 ? x : y)
const same = (x, y) => x != null && y != null && compare(x, y) === 0

function depthOf(match) {
  // Third place sits just under the final, below the finalists.
  if (match.bracket === 'third') return [1, match.round_no - 0.5]
  return [BRACKET_RANK[match.bracket] ?? 0, match.round_no]
}

// A losers or grand-final run supersedes earlier winners rounds; same bracket keeps the later round.
function further(current, candidate) {
  if (!current) return candidate
  if (current[0] === candidate[0]) return maxOf(current, candidate)
  if (SUPERSEDING.includes(current[0]) && SUPERSEDING.includes(candidate[0])) {
    return maxOf(current, candidate)
  }
  return SUPERSEDING.includes(candidate[0]) ? candidate : current
}

/** Winner of a terminal match (nothing further to play), or null while running. */
export function championOf(matches) {
  const byId = new Map(matches.map((m) => [m.id, m]))

  const candidates = matches.filter((m) => {
    if (!played(m) || m.bracket === 'third') return false
    const next = m.next_match_win ? byId.get(m.next_match_win) : null
    // An empty decider behind a grand final means the grand final settled it.
    return !next || (next.a == null && next.b == null)
  })
  if (candidates.length === 0) return null

  const key = (m) => [...depthOf(m), m.position]
  return candidates.reduce((best, m) => (compare(key(m), key(best)) > 0 ? m : best)).winner
}

// Knockout: placed by how far each entrant got; same depth shares a position.
function eliminationPlacements(matches) {
  // Nothing played yet: no standings, rather than everyone tied for 1st.
  if (!matches.some(played)) return new Map()

  const reached = new Map()
  for (const match of matches) {
    for (const id of [match.a, match.b]) {
      if (id != null) reached.set(id, further(reached.get(id), depthOf(match)))
    }
  }

  const winner = championOf(matches)

  // Only the match that ended a run counts as being beaten.
  const beaten = new Set()
  for (const match of matches.filter(played)) {
    const loser = match.winner === match.a ? match.b : match.a
    if (same(reached.get(loser), depthOf(match))) beaten.add(loser)
  }

  const sortKey = (id) => {
    const [rank, round] = reached.get(id)
    return [-rank, -round, id !== winner, beaten.has(id)]
  }
  const ordered = [...reached.keys()].sort((x, y) => compare(sortKey(x), sortKey(y)))

  const result = new Map()
  let previous = null
  let position = 0

  ordered.forEach((id, i) => {
    const index = i + 1
    if (winner != null && id === winner) {
      result.set(id, 1)
      previous = null
      position = 1
      return
    }

    const depth = [...reached.get(id), beaten.has(id)]
    if (!previous || compare(depth, previous) !== 0) {
      // Mid-tournament the deepest survivors share 1st (shown as T1).
      position = index
      previous = depth
    }
    result.set(id, position)
  })

  return result
}

// Round robin / Swiss: points, then head-to-head, Buchholz, wins, label.
function pointsTable(tournament) {
  const config = { ...DEFAULT_POINTS, ...(tournament.settings?.points ?? {}) }
  const rows = new Map(
    (tournament.entrants ?? []).map((e) => [
      e.id,
      {
        entrant_id: e.id,
        label: e.label,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        opponents: [],
      },
    ]),
  )
  const h2h = new Map()

  for (const match of tournament.matches.filter(played)) {
    const a = rows.get(match.a)
    const b = rows.get(match.b)
    if (!a || !b) continue

    a.played += 1
    b.played += 1
    a.opponents.push(b.entrant_id)
    b.opponents.push(a.entrant_id)

    const score = match.score ?? {}
    if (Object.keys(score).length > 0 && score.a === score.b) {
      a.draws += 1
      b.draws += 1
      a.points += config.draw
      b.points += config.draw
      continue
    }

    const [win, lose] = match.winner === match.a ? [a, b] : [b, a]
    win.wins += 1
    win.points += config.win
    lose.losses += 1
    lose.points += config.loss
    const pair = `${win.entrant_id}:${lose.entrant_id}`
    h2h.set(pair, (h2h.get(pair) ?? 0) + 1)
  }

  for (const row of rows.values()) {
    row.buchholz = row.opponents.reduce((sum, id) => sum + (rows.get(id)?.points ?? 0), 0)
  }

  // Code-point label order, matching Python's string sort.
  const list = [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.buchholz - x.buchholz ||
      y.wins - x.wins ||
      (x.label < y.label ? -1 : x.label > y.label ? 1 : 0),
  )

  // Head-to-head as one adjacent pass, since it isn't transitive.
  for (let i = 0; i < list.length - 1; i += 1) {
    const [upper, lower] = [list[i], list[i + 1]]
    if (upper.points !== lower.points || upper.buchholz !== lower.buchholz) continue
    const upperWon = h2h.get(`${upper.entrant_id}:${lower.entrant_id}`) ?? 0
    const lowerWon = h2h.get(`${lower.entrant_id}:${upper.entrant_id}`) ?? 0
    if (lowerWon > upperWon) [list[i], list[i + 1]] = [lower, upper]
  }

  return list.map((row) => {
    const { opponents: _, ...rest } = row
    return { ...rest, win_rate: row.played ? Math.round((row.wins / row.played) * 1000) / 1000 : 0 }
  })
}

/** Rows in the same shape as GET /tournaments/:id/standings/. */
export function standingsFor(tournament) {
  if (!tournament?.matches) return []

  if (tournament.format === 'single' || tournament.format === 'double') {
    const labels = new Map((tournament.entrants ?? []).map((e) => [e.id, e.label]))
    return [...eliminationPlacements(tournament.matches).entries()]
      .filter(([id]) => labels.has(id))
      .sort((x, y) => x[1] - y[1])
      .map(([id, placement]) => ({ entrant_id: id, label: labels.get(id), placement }))
  }

  return pointsTable(tournament)
}

/**
 * Entrants knocked out, from cached matches so the roster greys them on click.
 * Mirrors advance_winner/_resolve_grand_final in backend brackets/advance.py. Knockouts only.
 */
export function eliminatedIds(tournament) {
  const out = new Set()
  if (!['single', 'double'].includes(tournament?.format)) return out

  for (const match of tournament.matches.filter(played)) {
    const loser = match.winner === match.a ? match.b : match.a

    if (match.bracket === 'final') {
      // Grand final: losing as the undefeated side (a) only forces the decider.
      if (!match.next_match_win || match.winner === match.a) out.add(loser)
      continue
    }

    if (!match.next_match_lose) out.add(loser)
    // No grand final: the losers final settles 3rd/4th, so its winner is out too.
    if (match.bracket === 'losers' && !match.next_match_win) out.add(match.winner)
  }
  return out
}
