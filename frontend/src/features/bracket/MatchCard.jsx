import { scoreFor } from './layout'

/**
 * One match in a bracket.
 *
 * Everything is reported by clicking a name, whatever the series length. A Bo1
 * resolves on the first click. A longer series adds a win each time, so a Bo5
 * ending 3-1 is four clicks in the order the games were actually played —
 * which is how a host uses this, one game at a time, rather than entering a
 * final score after the fact.
 */
export function MatchCard({ match, canReport, onReport, onClear }) {
  const decided = Boolean(match.winner)
  const ready = Boolean(match.a && match.b)
  const isSeries = match.best_of > 1

  function pick(side) {
    const needed = match.wins_needed
    const score = match.score ?? {}
    const mine = score[side] ?? 0
    const theirs = score[side === 'a' ? 'b' : 'a'] ?? 0

    // Bo1 has no count to walk through, so clicking the winner is an undo —
    // the same gesture that corrects a mis-click everywhere else.
    if (!isSeries && decided && match.winner === (side === 'a' ? match.a : match.b)) {
      onClear()
      return
    }

    // Clicking the side that lost a decided match is a correction: the host
    // picked the wrong name. Hand the win straight over rather than adding to
    // their count — incrementing here posted a score both sides had won (1-1
    // on a Bo1), which the server rightly refuses.
    if (decided && match.winner !== (side === 'a' ? match.a : match.b)) {
      onReport(side === 'a' ? needed : 0, side === 'a' ? 0 : needed)
      return
    }

    // In a series the count keeps cycling: each click adds a win, and one past
    // the threshold wraps back to zero. Clicking is the only input here, so it
    // has to walk down as well as up — otherwise an over-click on a Bo5 would
    // strand the match with no way back.
    const next = mine >= needed ? 0 : mine + 1

    // Wrapping to zero also clears the opponent, since a series that has been
    // reset should read 0-0 rather than leaving the loser's games standing.
    const other = next === 0 ? 0 : theirs

    onReport(side === 'a' ? next : other, side === 'a' ? other : next)
  }

  /** What a click will do, for a series where it is not simply "wins". */
  function hintFor(side) {
    const label = side === 'a' ? match.a_label : match.b_label

    // A decided match reads the same whatever the series length: one side is
    // being handed the win. Saying "wins a game" there would describe an
    // increment that no longer happens.
    if (decided && match.winner !== (side === 'a' ? match.a : match.b)) {
      return `Give the win to ${label} instead`
    }

    if (!isSeries) return null

    const mine = (match.score ?? {})[side] ?? 0

    return mine >= match.wins_needed
      ? `Reset the series: click to start ${label} again at 0`
      : `${label} wins a game (${mine + 1} of ${match.wins_needed})`
  }

  return (
    <div
      className={`bg-base-100 rounded-lg border-2 shadow-sm transition-colors ${
        decided ? 'border-base-300' : ready ? 'border-primary/60' : 'border-base-300/70'
      }`}
    >
      <div className="divide-base-300/60 divide-y">
        <Side
          match={match}
          side="a"
          canReport={canReport && ready}
          onPick={() => pick('a')}
          seriesHint={hintFor('a')}
        />
        <Side
          match={match}
          side="b"
          canReport={canReport && ready}
          onPick={() => pick('b')}
          seriesHint={hintFor('b')}
        />
      </div>

      {/* The footer names the series and how it stands. With clicking as the
          only input, saying "first to 2" is what makes an incrementing score
          legible — otherwise 1-1 on a Bo3 gives no clue how close it is. */}
      {isSeries && (
        <div className="border-base-300/60 flex items-center justify-between border-t px-3 py-1">
          <span className="text-base-content/50 text-xs tracking-wide uppercase">
            Bo{match.best_of}
          </span>

          {!decided && (
            <span className="text-base-content/40 text-xs">First to {match.wins_needed}</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Every state of a match side renders at this exact height.
 *
 * A filled slot is a button and an empty one a div, at different font sizes —
 * so without a fixed height the card grew or shrank the instant a name landed
 * in it, which read as a flicker on every click.
 */
const ROW = 'flex h-11 items-center px-3'

function Side({ match, side, canReport, onPick, seriesHint }) {
  const entrantId = side === 'a' ? match.a : match.b
  const label = side === 'a' ? match.a_label : match.b_label
  const isWinner = match.winner && match.winner === entrantId
  const decided = Boolean(match.winner)
  const score = scoreFor(match, side)

  // A walkover: one entrant, no opponent, so they advance without playing.
  // Never shown as a win — nobody clicked anything and no game happened.
  const isWalkover = !match.a || !match.b

  // An empty slot is either the empty half of a walkover or a match still
  // waiting on its feeder. The wording matters: "No opponent" is final,
  // "TBD" is not, and confusing the two makes a bracket look broken.
  if (!entrantId) {
    return (
      <div className={`${ROW} text-base-content/40 text-sm italic`}>
        {isWalkover && decided ? 'No opponent' : 'TBD'}
      </div>
    )
  }

  const content = (
    <>
      <span className={`truncate ${isWinner && !isWalkover ? 'font-semibold' : 'font-medium'}`}>
        {label}
      </span>

      {/* A walkover is annotated rather than scored: there was no game. */}
      {isWalkover && decided && (
        <span className="text-base-content/50 ml-auto pl-2 text-xs tracking-wide uppercase">
          advances
        </span>
      )}

      {score !== null && (
        <span className={`tabular ml-auto pl-2 ${isWinner ? 'font-bold' : 'font-medium'}`}>
          {score}
        </span>
      )}
    </>
  )

  // Losers grey out, winners are highlighted. A walkover gets neither: it was
  // never contested, so tinting it green would claim a result that never
  // happened.
  const state = isWalkover
    ? ''
    : isWinner
      ? 'bg-primary/25 text-base-content'
      : decided
        ? 'text-base-content/45 line-through decoration-base-content/35'
        : ''

  const base = `${ROW} w-full text-left ${state}`

  if (!canReport) {
    return <div className={base}>{content}</div>
  }

  return (
    <button
      className={`${base} hover:bg-primary/20 transition-colors`}
      onClick={onPick}
      title={seriesHint ?? (isWinner ? `Undo: ${label} won` : `${label} wins`)}
    >
      {content}
    </button>
  )
}
