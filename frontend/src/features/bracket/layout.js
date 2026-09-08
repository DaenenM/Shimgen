/**
 * Turning a flat list of matches into something renderable.
 *
 * The API returns matches as a graph — each carrying `round_no`, `position`,
 * `bracket` and its advancement edges. These helpers group that into columns
 * without the components needing to know anything about the graph structure.
 */

export const FORMAT_LABELS = {
  single: 'Single elimination',
  double: 'Double elimination',
  rr: 'Round robin',
  swiss: 'Swiss',
  ffa: 'Free-for-all',
}

/**
 * Group matches into ordered rounds within one bracket section.
 *
 * Returns [{ roundNo, matches }], ascending. Rounds are derived from the data
 * rather than counted from the entrant list, because byes and phantom matches
 * mean the two do not always agree.
 */
export function toRounds(matches, section = 'main') {
  const inSection = matches.filter((m) => m.bracket === section)

  const byRound = new Map()
  for (const match of inSection) {
    if (!byRound.has(match.round_no)) byRound.set(match.round_no, [])
    byRound.get(match.round_no).push(match)
  }

  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundNo, group]) => ({
      roundNo,
      matches: group.sort((a, b) => a.position - b.position),
    }))
}

/**
 * A human name for a round, counted back from the final.
 *
 * "Semifinal" is more useful than "Round 3", and which round *is* the semifinal
 * depends on how many there are — so it can only be named relative to the end.
 */
export function roundLabel(roundNo, totalRounds, section = 'main') {
  // A second grand final only exists when the losers-bracket winner took the
  // first one, forcing a decider (plan §3).
  if (section === 'final') return roundNo === totalRounds ? 'Bracket reset' : 'Grand final'
  if (section === 'third') return 'Third place'

  const fromEnd = totalRounds - roundNo
  const prefix = section === 'losers' ? 'Losers ' : ''

  if (fromEnd === 0) return `${prefix}Final`
  if (fromEnd === 1) return `${prefix}Semifinal`
  if (fromEnd === 2) return `${prefix}Quarterfinal`

  return `${prefix}Round ${roundNo}`
}

/** Which bracket sections this tournament actually uses, in display order. */
export function sectionsFor(matches) {
  const present = new Set(matches.map((m) => m.bracket))

  return ['main', 'losers', 'third', 'final'].filter((s) => present.has(s))
}

export const SECTION_LABELS = {
  main: 'Winners bracket',
  losers: 'Losers bracket',
  third: 'Third place',
  final: 'Grand final',
}

/**
 * Whether a match can never be contested and should be hidden.
 *
 * A phantom is a losers-bracket match in a heavily-byed draw whose two feeders
 * were both walkovers: nobody ever arrives, so rendering it shows an empty slot
 * that will never fill and no way to know why.
 *
 * Emptiness alone is *not* enough to identify one — an un-played final is also
 * empty, and is the single most important match on the page. The distinction is
 * whether anything upstream can still deliver an entrant, so this looks at the
 * feeders rather than at the match in isolation.
 */
export function isPhantom(match, allMatches) {
  if (match.a || match.b || match.winner) return false

  const feeders = allMatches.filter(
    (m) => m.next_match_win === match.id || m.next_match_lose === match.id,
  )

  // No feeders at all means it is seeded directly, so it is not a phantom.
  if (feeders.length === 0) return false

  // Still reachable while any feeder is undecided, or while a decided feeder
  // has a loser to send down.
  return feeders.every((feeder) => {
    if (!feeder.winner) return false
    const wasBye = !feeder.a || !feeder.b
    return feeder.next_match_lose === match.id ? wasBye : false
  })
}

/** Series score for a side, as a display string. */
export function scoreFor(match, side) {
  const score = match.score ?? {}
  if (score[side] === undefined) return null
  return String(score[side])
}
