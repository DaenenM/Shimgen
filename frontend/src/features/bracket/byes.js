/**
 * Bye arithmetic, for warning a host before they commit to a bracket.
 *
 * An elimination bracket is a binary tree, so it always has a power-of-two
 * number of slots. Any entrant count that is not itself a power of two leaves
 * spare slots, and whoever draws one advances a round without playing.
 *
 * That is correct and standard — but on a fresh double-elimination bracket it
 * looks alarming, because the losers bracket is drawn empty and several
 * first-round matches already show a winner. Saying so up front is cheaper than
 * explaining it afterwards.
 *
 * Note that multiples of four do not avoid this: 12 entrants in a 16-slot
 * bracket still leaves 4 byes. Only exact powers of two are bye-free.
 */

export function nextPowerOfTwo(n) {
  if (n <= 1) return 1
  return 2 ** Math.ceil(Math.log2(n))
}

export function byeCount(entrantCount) {
  if (entrantCount < 2) return 0
  return nextPowerOfTwo(entrantCount) - entrantCount
}

/** The nearest bye-free sizes either side, to suggest in the warning. */
export function cleanSizes(entrantCount) {
  const upper = nextPowerOfTwo(entrantCount)
  return { lower: upper / 2, upper }
}

/**
 * A warning for the host, or null when the draw is clean.
 *
 * Only elimination formats care: round robin, Swiss and free-for-all handle any
 * count without byes at all.
 */
export function byeWarning(format, entrantCount) {
  if (format !== 'single' && format !== 'double') return null
  if (entrantCount < 2) return null

  const byes = byeCount(entrantCount)
  if (byes === 0) return null

  const { lower, upper } = cleanSizes(entrantCount)

  return {
    byes,
    message:
      `${byes} ${byes === 1 ? 'entrant gets' : 'entrants get'} a free first round, ` +
      `because a bracket holds ${nextPowerOfTwo(entrantCount)} slots and you have ` +
      `${entrantCount}.`,
    hint: `${lower} or ${upper} entrants would give everyone a first-round match.`,
  }
}
