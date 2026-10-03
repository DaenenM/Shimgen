import { scoreFor } from '../utils/layout'

/**
 * Every state of a match side renders at this exact height.
 *
 * A filled slot is a button and an empty one a div, at different font sizes —
 * so without a fixed height the card grew or shrank the instant a name landed
 * in it, which read as a flicker on every click.
 */
const ROW = 'relative flex h-9.5 items-center pr-3 pl-4'

export function MatchSide({ match, side, canReport, onPick, seriesHint, tone }) {
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
  // never contested, so tinting it would claim a result that never happened.
  //
  // The brand blue, matching the rest of the page: this is the one colour the
  // eye is already tracking everywhere else, so a winner reads instantly
  // without learning a second key. The left edge carries most of the signal —
  // a wash alone turns a 32-match bracket into a field of tinted boxes, while
  // an edge marker stays legible stacked that deep.
  const state = isWalkover
    ? ''
    : isWinner
      ? 'text-base-content font-semibold rounded-t-md'
      : decided
        ? 'text-base-content/45 line-through decoration-base-content/35'
        : ''

  const base = `${ROW} w-full text-left ${state}`

  // The wash is an inline style rather than a class because the hue comes from
  // the round, which only the bracket knows.
  const fill = isWinner && !isWalkover && tone ? { backgroundColor: tone.wash } : undefined

  // Rounded at both ends rather than square, so it reads as a deliberate marker
  // rather than as the card's border having changed colour. Inset by a hair
  // top and bottom for the same reason.
  const marker = isWinner && !isWalkover && (
    <span
      className="absolute inset-y-0 left-0 w-1 rounded-tl-full"
      style={{ backgroundColor: tone?.edge ?? 'var(--color-primary)' }}
      aria-hidden="true"
    />
  )

  if (!canReport) {
    return (
      <div className={base} style={fill}>
        {marker}
        {content}
      </div>
    )
  }

  return (
    <button
      className={`${base} hover:bg-base-content/8 transition-colors`}
      style={fill}
      onClick={onPick}
      title={seriesHint ?? (isWinner ? `Undo: ${label} won` : `${label} wins`)}
    >
      {marker}
      {content}
    </button>
  )
}
