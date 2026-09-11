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
 * The colour a round is played in, heating up toward the final.
 *
 * The bracket's own shape is an escalation — eight matches become four, then
 * two, then the one everybody stays for — and the old all-blue rendering threw
 * that away, so round one and the final looked identical. Hue carries it
 * instead: cool blue early, violet through the middle, amber at the end, which
 * is the accent the rest of the app already uses for victory.
 *
 * Counted back from the final rather than forward from round one, for the same
 * reason `roundLabel` is: which round is the semifinal depends on how many
 * there are.
 *
 * Chroma climbs with the heat too. A vivid amber next to a vivid blue at equal
 * saturation reads as two arbitrary colours; letting the late rounds be the
 * more saturated ones is what makes the sequence feel like a build.
 */
const ROUND_HUES = [
  { hue: 80, chroma: 0.15 }, // the final — amber, the app's victory colour
  { hue: 300, chroma: 0.13 }, // semifinal — violet
  { hue: 265, chroma: 0.12 }, // quarterfinal — indigo
  { hue: 230, chroma: 0.11 }, // earlier rounds — blue
]

/**
 * `fromEnd` 0 is the final, 1 the semifinal, and so on. Anything earlier than
 * the scale has to share the coolest tone: a twelve-round bracket cannot have
 * twelve distinguishable hues, and pretending otherwise gives two adjacent
 * rounds colours nobody can tell apart.
 */
export function roundTone(roundNo, totalRounds, section = 'main') {
  // The losers bracket runs alongside the winners bracket rather than after it,
  // so heating it on the same scale would give a losers round the final's gold.
  // It stays cool throughout — it is the second chance, not the climax.
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
 *
 * `displayNo` is what an ordinary round gets numbered. It exists because a
 * losers bracket with byes has whole rounds hidden: `round_no` 2 can be the
 * first column on the page, and "Losers round 2" then points at a round one
 * nobody can see. The caller passes the position among the columns it actually
 * drew. The named rounds ignore it — a semifinal is the semifinal however many
 * rounds preceded it.
 */
export function roundLabel(roundNo, totalRounds, section = 'main', displayNo = roundNo) {
  // A second grand final only exists when the losers-bracket winner took the
  // first one, forcing a decider (plan §3).
  if (section === 'final') return roundNo === totalRounds ? 'Bracket reset' : 'Grand final'
  if (section === 'third') return 'Third place'

  const fromEnd = totalRounds - roundNo
  const prefix = section === 'losers' ? 'Losers ' : ''

  if (fromEnd === 0) return `${prefix}Final`
  if (fromEnd === 1) return `${prefix}Semifinal`
  if (fromEnd === 2) return `${prefix}Quarterfinal`

  return `${prefix}Round ${displayNo}`
}

/**
 * How wide a bracket draws itself, by how many columns it has to fit.
 *
 * A 28-entrant draw is five columns in the winners bracket and six in the
 * losers, and at full size that is far wider than any laptop — so the whole
 * thing became a side-scroller and no single view showed the shape of the
 * tournament, which is the one thing a bracket is for.
 *
 * Two invariants hold across every tier, and both have broken before:
 *
 *  - **`gap` is exactly twice `arm`.** The two arms of a connector sit inside
 *    the gap, so any other ratio leaves the elbow short of the card or running
 *    past it.
 *  - **`card` is used by the heading row and the card column alike.** They are
 *    separate flex rows that have to agree, or every round label drifts
 *    sideways from the column it names.
 *
 * Only horizontal measurements shrink. Row height is fixed in `MatchCard` so a
 * slot does not resize the instant a name lands in it, and names already
 * truncate — so a narrower card loses some of a long team name and nothing
 * else. Losing the tail of "Team 28" beats losing the bracket.
 *
 * Lives here rather than in `BracketView` because it is a pure function, and a
 * component file that also exports one breaks Fast Refresh.
 */
const SIZES = {
  // Four columns or fewer: a quarterfinal onward, which fits comfortably.
  roomy: { card: 'w-52 sm:w-64', gap: 'w-10 sm:w-16', arm: 'w-5 sm:w-8' },
  // Five columns — the winners bracket of a 17-32 entrant draw.
  compact: { card: 'w-40 sm:w-48', gap: 'w-8 sm:w-10', arm: 'w-4 sm:w-5' },
  // Six or more, which is where a losers bracket of that size lands.
  tight: { card: 'w-32 sm:w-40', gap: 'w-6 sm:w-8', arm: 'w-3 sm:w-4' },
}

/**
 * Picked per section rather than per tournament: the winners and losers
 * brackets are independent scrollers with different column counts, and sizing
 * both to the wider one would shrink the winners bracket for no reason.
 */
export function sizeFor(columnCount) {
  if (columnCount >= 6) return SIZES.tight
  if (columnCount === 5) return SIZES.compact
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

/**
 * Whether a match should be hidden because it can never be a real contest.
 *
 * A double-elimination bracket is built for the next power of two, so a draw of
 * five entrants gets a losers bracket sized for eight. Several of those slots
 * are fed only by byes, which produces a "Losers round 1" of TBD-versus-TBD and
 * a half-empty "Losers quarterfinal" where somebody stands alone marked
 * ADVANCES. Both read as a broken bracket rather than as byes working
 * correctly.
 *
 * The test is **capacity**: how many entrants could this slot ever hold, at
 * best, across every way the tournament could still play out? Fewer than two
 * means no match can ever happen here — it is either dead or a corridor
 * somebody walks through untouched — so it is hidden.
 *
 * Capacity ignores results entirely. It asks only what the edges allow, which
 * is why the bracket is correct the moment it is created rather than tidying
 * itself up as results land. A slot's capacity never changes, so nothing
 * appears or disappears mid-tournament.
 *
 * Hiding a one-capacity slot does not make anybody vanish: their single
 * occupant is delivered straight on to the next slot, and the first one with
 * room for two is by definition a real match that stays on the page. The chain
 * simply collapses to where the bracket actually begins.
 *
 * Two things are deliberately exempt:
 *
 *  - **The winners bracket.** The same one-sided shape there is a first-round
 *    bye, and that is real information: it says who sat out and why they appear
 *    in round two without having played. Hide it and the bracket looks like it
 *    skipped somebody.
 *  - **A contested match.** Once two entrants have actually played, it is
 *    history and stays on the page whatever the arithmetic says.
 *
 * A *walkover* is deliberately not exempt, and that distinction is the whole
 * reason this is not simply `if (match.winner) return false`. When the winners
 * match above a capacity-1 slot resolves, the backend cascades the lone
 * occupant onward and stamps a winner on the slot on its way past. Treating
 * that as history brought every hidden slot back the moment a result landed —
 * the bracket was clean when created and sprouted dead rounds as it was played.
 * Nobody played them; the engine walked somebody through.
 */
export function isPhantom(match, allMatches) {
  // Two entrants means a real game happened, whatever the arithmetic says.
  // One or none is a walkover the engine resolved, which earns no exemption.
  if (match.winner && match.a && match.b) return false

  // Only the losers bracket. The winners bracket's one-sided matches are byes,
  // which explain themselves; the grand final and the bracket reset are the
  // climax of the page and are seated from two different brackets, so counting
  // feeders understates them.
  if (match.bracket !== 'losers') return false

  return capacity(match, allMatches) < 2
}

/**
 * The most entrants this match could ever hold.
 *
 * Counts the seats already filled, then asks each feeder whether its edge could
 * ever deliver somebody — assuming, unlike a reachability count, that every
 * undecided match upstream fills as fully as its own edges allow. That is what
 * keeps the answer independent of results.
 *
 * The losing edge is the interesting one: a feeder needs two entrants to
 * produce a loser at all, so a slot that can only ever hold one drops nobody.
 * That single fact is what propagates a bye's emptiness down the bracket.
 *
 * Memoised across the whole walk, which also stops a malformed graph with a
 * cycle from recursing forever — a match already being resolved contributes
 * nothing rather than reentering.
 */
function capacity(match, allMatches, memo = new Map()) {
  const cached = memo.get(match.id)
  if (cached !== undefined) return cached

  // Seeded before the real value so a cycle terminates instead of recursing.
  memo.set(match.id, 0)

  let count = (match.a ? 1 : 0) + (match.b ? 1 : 0)

  for (const feeder of allMatches) {
    const advancing = feeder.next_match_win === match.id
    const dropping = feeder.next_match_lose === match.id
    if (!advancing && !dropping) continue

    // A decided feeder has already sent whoever it was going to send, and
    // anyone it seated is counted above.
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
