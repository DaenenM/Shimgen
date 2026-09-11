/**
 * Team generation, in the browser.
 *
 * Splitting a list of names into teams needs nothing the server has: no stored
 * state, no other user's data, no durability. It was a round trip per re-roll,
 * and re-rolling is the whole interaction — you press it until the split looks
 * right. Doing it locally makes that instant and works offline.
 *
 * This mirrors backend/apps/tournaments/teams.py: same randomise-and-retry
 * approach, same rules, same "is this last week's split again" check. The
 * server version stays for the API and for rating-balanced splits, which need
 * Elo the browser does not hold.
 *
 * Only the rules the generator page can actually express are implemented —
 * `apart` and `together`. Rating balance and locked seats are server-side.
 */

// Enough attempts for any realistic game night; past this the constraints are
// almost certainly contradictory rather than merely tight.
const MAX_ATTEMPTS = 5000

export class TeamGenerationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TeamGenerationError'
  }
}

/**
 * Split `players` into `teamCount` teams.
 *
 * `players` is a list of `{ id, name }`. Returns a list of lists of the same.
 * `avoid` is a previous arrangement (lists of ids) not to reproduce, so a
 * re-roll does not hand back the split just rejected.
 */
export function generateTeams(players, teamCount, { constraints = [], avoid = null } = {}) {
  if (teamCount < 1) throw new TeamGenerationError('At least one team is required.')
  if (players.length < teamCount) {
    throw new TeamGenerationError(`${players.length} players cannot fill ${teamCount} teams.`)
  }

  rejectImpossible(constraints, players, teamCount)

  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const teams = attempt(players, teamCount, constraints)
    if (!teams) continue
    if (avoid && sameArrangement(teams, avoid)) continue
    return teams
  }

  throw new TeamGenerationError(
    'No arrangement satisfies these constraints. Check for a player who must ' +
      'be both with and apart from the same person.',
  )
}

/**
 * Catch contradictions before burning 5000 attempts on them.
 *
 * Failing fast gives a useful message instead of a generic "no arrangement".
 */
function rejectImpossible(constraints, players, teamCount) {
  const key = (rule) => [...rule.player_ids].sort().join('|')

  const together = new Set(constraints.filter((r) => r.kind === 'together').map(key))
  const apart = new Set(constraints.filter((r) => r.kind === 'apart').map(key))

  for (const pair of together) {
    if (apart.has(pair)) {
      throw new TeamGenerationError(
        'A pair is marked both together and apart; remove one of the rules.',
      )
    }
  }

  // A TOGETHER group larger than a team can hold can never be placed.
  const largest = constraints
    .filter((r) => r.kind === 'together')
    .reduce((max, r) => Math.max(max, r.player_ids.length), 0)
  const capacity = Math.ceil(players.length / teamCount)

  if (largest > capacity) {
    throw new TeamGenerationError(
      `A group of ${largest} players cannot fit in a team of at most ${capacity}.`,
    )
  }
}

/** One randomised arrangement, or null if it breaks a rule. */
function attempt(players, teamCount, constraints) {
  const teams = Array.from({ length: teamCount }, () => [])

  const pool = shuffle([...players])

  // TOGETHER groups are seated as units, so a merged group lands whole.
  const groups = togetherGroups(constraints)
  const units = []
  const seen = new Set()

  for (const group of groups) {
    const members = pool.filter((p) => group.has(p.id))
    if (members.length) {
      units.push(members)
      members.forEach((m) => seen.add(m.id))
    }
  }

  for (const player of pool) {
    if (!seen.has(player.id)) units.push([player])
  }

  // Seat each unit in the smallest team, so sizes stay even.
  for (const unit of shuffle(units)) {
    let target = 0
    for (let i = 1; i < teamCount; i += 1) {
      if (teams[i].length < teams[target].length) target = i
    }
    teams[target].push(...unit)
  }

  return satisfies(teams, constraints) ? teams : null
}

/**
 * Merge overlapping TOGETHER rules into connected groups.
 *
 * "A with B" and "B with C" means all three share a team, which is only
 * correct if the rules are unioned rather than applied pairwise.
 */
function togetherGroups(constraints) {
  const groups = []

  for (const rule of constraints) {
    if (rule.kind !== 'together') continue

    let ids = new Set(rule.player_ids)
    const overlapping = groups.filter((g) => [...ids].some((id) => g.has(id)))

    for (const g of overlapping) {
      ids = new Set([...ids, ...g])
      groups.splice(groups.indexOf(g), 1)
    }

    groups.push(ids)
  }

  return groups
}

/** Check an arrangement against every rule. */
function satisfies(teams, constraints) {
  const location = new Map()
  teams.forEach((team, index) => team.forEach((p) => location.set(p.id, index)))

  for (const rule of constraints) {
    const present = rule.player_ids.filter((id) => location.has(id))

    if (rule.kind === 'apart') {
      const spots = present.map((id) => location.get(id))
      if (spots.length !== new Set(spots).size) return false
    } else if (rule.kind === 'together') {
      const spots = new Set(present.map((id) => location.get(id)))
      if (spots.size > 1) return false
    }
  }

  return true
}

/**
 * True if `teams` is the arrangement we were told to avoid, ignoring order.
 *
 * Compared as sets so "team 1 and team 2 swapped places" counts as the same
 * arrangement — which it is, to the people playing.
 */
function sameArrangement(teams, previous) {
  const asKey = (lists) =>
    lists
      .filter((team) => team.length)
      .map((team) => [...team].sort().join(','))
      .sort()
      .join(';')

  return asKey(teams.map((team) => team.map((p) => p.id))) === asKey(previous)
}

/** Fisher-Yates, on a copy the caller already made. */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** Team sizes for `total` players across `teams`, as even as possible. */
export function splitEvenly(total, teams) {
  const base = Math.floor(total / teams)
  const extra = total % teams
  return Array.from({ length: teams }, (_, i) => (i < extra ? base + 1 : base))
}
