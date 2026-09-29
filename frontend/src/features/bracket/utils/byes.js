// Bye math, for warning a host before they commit to a bracket. An elimination
// bracket always has a power-of-two slot count, so any other entrant count
// leaves byes (entrants who advance without playing round 1). Used by
// useNewTournamentForm.js.

function nextPowerOfTwo(n) {
  if (n <= 1) return 1
  return 2 ** Math.ceil(Math.log2(n))
}

function byeCount(entrantCount) {
  if (entrantCount < 2) return 0
  return nextPowerOfTwo(entrantCount) - entrantCount
}

// Nearest bye-free sizes either side, to suggest in the warning.
function cleanSizes(entrantCount) {
  const upper = nextPowerOfTwo(entrantCount)
  return { lower: upper / 2, upper }
}

// Warning for the host, or null when the draw is clean. Only elimination
// formats have byes — round robin/Swiss/free-for-all handle any count.
export function byeWarning(format, entrantCount) {
  if (format !== 'single' && format !== 'double') return null
  if (entrantCount < 2) return null

  const byes = byeCount(entrantCount)
  if (byes === 0) return null

  const { lower, upper } = cleanSizes(entrantCount)

  return {
    byes,
    message: `${byes} ${byes === 1 ? 'entrant skips' : 'entrants skip'} round 1.`,
    hint: `Use ${lower} or ${upper} entrants so everyone plays.`,
  }
}
