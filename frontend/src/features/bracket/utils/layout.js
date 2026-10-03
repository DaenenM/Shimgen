// Turns the flat match-graph the API returns into columns, labels and colors for rendering.
// Used by BracketView.jsx, BracketRound.jsx, RoundList.jsx, MatchSide.jsx, TournamentHeader.jsx.

export const FORMAT_LABELS = {
  single: 'Single elimination',
  double: 'Double elimination',
  rr: 'Round robin',
  swiss: 'Swiss',
}

// The colour a round is played in, heating up toward the final: cool blue early,
// violet mid, amber (the app's victory colour) at the end.
const ROUND_HUES = [
  { hue: 80, chroma: 0.15 }, // the final — amber, the app's victory colour
  { hue: 300, chroma: 0.13 }, // semifinal — violet
  { hue: 265, chroma: 0.12 }, // quarterfinal — indigo
  { hue: 230, chroma: 0.11 }, // earlier rounds — blue
]

// `fromEnd` 0 is the final, 1 the semifinal, etc. Anything earlier than the scale
// shares the coolest tone — a 12-round bracket can't have 12 distinguishable hues.
export function roundTone(roundNo, totalRounds, section = 'main') {
  // Losers bracket runs alongside winners, not after it, so it stays cool throughout
  // rather than sharing the final's gold.
  const fromEnd = section === 'losers' ? ROUND_HUES.length - 1 : totalRounds - roundNo

  const { hue, chroma } = ROUND_HUES[Math.min(Math.max(fromEnd, 0), ROUND_HUES.length - 1)]

  return {
    /** Text and icons: light on dark, dark on light. */
    color: `light-dark(oklch(45% ${chroma + 0.03} ${hue}), oklch(76% ${chroma} ${hue}))`,
    /** A wash for a winner's row. */
    wash: `light-dark(oklch(45% ${chroma + 0.03} ${hue} / 0.16), oklch(76% ${chroma} ${hue} / 0.22))`,
    /** The solid edge marker beside a winner. */
    edge: `light-dark(oklch(45% ${chroma + 0.03} ${hue}), oklch(76% ${chroma} ${hue}))`,
    /** A soft glow, for the card that is next to be played. */
    glow: `light-dark(oklch(45% ${chroma + 0.03} ${hue} / 0.25), oklch(76% ${chroma} ${hue} / 0.3))`,
  }
}

// Group matches into ordered rounds within one bracket section. Returns [{ roundNo, matches }],
// ascending. Derived from the data, not the entrant list, since byes and phantom matches disagree.
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

// A human name for a round, counted back from the final ("Semifinal" beats "Round 3").
// `displayNo` is the position among columns actually drawn — needed because a losers
// bracket with byes can hide whole rounds, so `round_no` alone would misnumber it.
export function roundLabel(roundNo, totalRounds, section = 'main', displayNo = roundNo) {
  // A second grand final only exists when the losers-bracket winner forced a decider (plan §3).
  if (section === 'final') return roundNo === totalRounds ? 'Bracket reset' : 'Grand final'
  if (section === 'third') return 'Third place'

  const fromEnd = totalRounds - roundNo
  const prefix = section === 'losers' ? 'Losers ' : ''

  if (fromEnd === 0) return `${prefix}Final`
  if (fromEnd === 1) return `${prefix}Semifinal`
  if (fromEnd === 2) return `${prefix}Quarterfinal`

  return `${prefix}Round ${displayNo}`
}

// How wide a bracket draws itself, by column count. Two invariants:
//  - `gap` is exactly twice `arm` (the connector's two arms sit inside the gap).
//  - `card` is shared by the heading row and the card column, or labels drift.
// Only horizontal sizes shrink; row height is fixed in MatchCard.
// The unprefixed token is phone width, `sm:` is laptop width — tuned separately, don't merge them.
// Every tier shares one phone width on purpose: "two columns" is a viewport property, not a depth
// property, and letting phone width shrink with depth used to put a 28-entrant losers bracket at
// four unreadable columns. Only `sm:` steps down with depth.
// Lives here, not in BracketView, so the component file stays Fast-Refresh-safe (one export).
// Vertical padding around every card slot. Symmetric, so connector lines still meet card centres.
export const SLOT_PAD = 'py-3'

const SIZES = {
  // Four columns or fewer: a quarterfinal onward, which fits comfortably.
  roomy: { card: 'w-40 sm:w-60', gap: 'w-4 sm:w-14', arm: 'w-2 sm:w-7' },
  // Five columns — the winners bracket of a 17-32 entrant draw.
  compact: { card: 'w-40 sm:w-46', gap: 'w-4 sm:w-9', arm: 'w-2 sm:w-4.5' },
  // Six or more, which is where a losers bracket of that size lands.
  tight: { card: 'w-40 sm:w-36', gap: 'w-4 sm:w-7', arm: 'w-2 sm:w-3.5' },
}

// Per section, not per tournament: winners/losers are independent scrollers with
// different column counts, and sizing both to the wider one shrinks the other for no reason.
export function sizeFor(columnCount) {
  if (columnCount >= 6) return SIZES.tight
  if (columnCount === 5) return SIZES.compact
  return SIZES.roomy
}

// One section's drawable columns: phantoms marked hidden, dead rounds dropped, sized to fit.
// Used by BracketSection.jsx and DoubleEliminationLayout.jsx.
export function sectionColumns(matches, section) {
  const rounds = toRounds(matches, section)
  const totalRounds = rounds.length ? rounds[rounds.length - 1].roundNo : 0

  // Hidden rather than removed, so each round keeps the slot count its feeders expect.
  const columns = rounds
    .map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({ match, hidden: isPhantom(match, matches) })),
    }))
    .filter((round) => round.matches.some((slot) => !slot.hidden))

  return { columns, totalRounds, size: sizeFor(columns.length) }
}

// Size for the combined double-elimination grid (brackets + finals columns), stepped by
// what fits a ~1400px page: up to 4 roomy, up to 6 compact, then tight.
export function gridSizeFor(totalColumns) {
  if (totalColumns > 6) return SIZES.tight
  if (totalColumns > 4) return SIZES.compact
  return SIZES.roomy
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

// Whether a match should be hidden because it can never be a real contest.
// A double-elimination bracket is sized for the next power of two, so a losers
// bracket can have slots fed only by byes ("Losers round 1" of TBD-vs-TBD).
//
// Test is capacity: how many entrants could this slot ever hold, ignoring results
// entirely (so the bracket is correct at creation and never changes mid-tournament).
// Fewer than two capacity means hidden. The single occupant of a hidden slot still
// advances normally; the chain just collapses to where a real match begins.
//
// Exempt: the winners bracket (a one-sided slot there is a real first-round bye,
// worth showing) and any match that was actually contested (two entrants played).
// NOT exempt: a walkover with only a winner — the backend stamps a winner as it
// cascades a lone occupant through, and treating that as "history" would un-hide
// every dead slot the moment a result landed.
export function isPhantom(match, allMatches) {
  // Two entrants: a real game happened. One or none is a walkover, no exemption.
  if (match.winner && match.a && match.b) return false

  // A decided grand final won by the undefeated side (slot `a`, per `_slot_for`
  // on the backend) kills the bracket-reset decider behind it — it will never be played.
  if (isDeadBracketReset(match, allMatches)) return true

  // Only the losers bracket: winners-bracket one-sided matches are real byes,
  // and the grand final / bracket reset are seated from two brackets, not counted by feeders.
  if (match.bracket !== 'losers') return false

  return capacity(match, allMatches) < 2
}

// Whether this is a bracket-reset decider that can no longer happen: still empty,
// its grand final decided, and won from slot `a` (the undefeated side — `_slot_for`
// on the backend). A win from `b` levels the score and *does* bring the decider to
// life, so the slot check (not just "is decided") matters.
// Walks the edge backwards via `next_match_win` rather than assuming round numbers.
function isDeadBracketReset(match, allMatches) {
  if (match.bracket !== 'final') return false

  // Seated or played: a real match either way.
  if (match.a || match.b || match.winner) return false

  const grandFinal = allMatches.find(
    (candidate) =>
      candidate.bracket === 'final' &&
      candidate.next_match_win === match.id &&
      candidate.id !== match.id,
  )

  if (!grandFinal?.winner) return false

  return grandFinal.winner === grandFinal.a
}

// The most entrants this match could ever hold: seats already filled, plus each
// feeder that could still deliver somebody, assuming upstream fills as fully as
// its edges allow (keeps the answer independent of actual results).
// The losing edge matters: a feeder needs two entrants to produce a loser at all,
// so a one-capacity feeder drops nobody — this is how a bye's emptiness propagates.
// Memoised, which also stops a cycle in a malformed graph from recursing forever.
function capacity(match, allMatches, memo = new Map()) {
  const cached = memo.get(match.id)
  if (cached !== undefined) return cached

  // Seeded before the real value so a cycle terminates.
  memo.set(match.id, 0)

  let count = (match.a ? 1 : 0) + (match.b ? 1 : 0)

  for (const feeder of allMatches) {
    const advancing = feeder.next_match_win === match.id
    const dropping = feeder.next_match_lose === match.id
    if (!advancing && !dropping) continue

    // A decided feeder already sent whoever it was going to; counted above.
    if (feeder.winner) continue

    const upstream = capacity(feeder, allMatches, memo)

    if (dropping ? upstream >= 2 : upstream >= 1) count += 1
  }

  memo.set(match.id, count)
  return count
}

/** Series score for a side, as a display string. */
export function scoreFor(match, side) {
  const score = match.score ?? {}
  if (score[side] === undefined) return null
  return String(score[side])
}
