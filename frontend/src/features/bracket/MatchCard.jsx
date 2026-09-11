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
export function MatchCard({ match, canReport, onReport, onClear, tone }) {
  const decided = Boolean(match.winner)
  const ready = Boolean(match.a && match.b)
  const isSeries = match.best_of > 1

  function pick(side) {
    // Bo1 has no count to walk through, so clicking the winner is an undo —
    // the same gesture that corrects a mis-click everywhere else.
    if (!isSeries && decided && match.winner === (side === 'a' ? match.a : match.b)) {
      onClear()
      return
    }

    // Everything else is "this side won a game". The page turns that into a
    // score against the freshest cached match rather than the one this card
    // rendered with: two quick clicks on a series would otherwise both read the
    // score from before the first, and the second game would not count.
    onReport(side)
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
    // `glass-inset` (8px blur) rather than `glass-panel` (20px): a full
    // bracket puts thirty of these in one scroll view, and the cheaper blur is
    // what keeps that from costing frame rate on a phone. A ready match gets a
    // lit primary edge so the next thing to click is findable at a glance.
    <div
      className="glass-inset overflow-hidden transition-all duration-200"
      style={
        // Every card carries its round's colour; a ready one is lit brightest,
        // so the next thing to click announces itself *and* says how far into
        // the night it is. A still-waiting card keeps a quieter edge of the
        // same hue rather than going grey — otherwise the final, the one card
        // the whole page builds toward, is the dullest thing on it until its
        // feeders land.
        tone
          ? ready
            ? {
                borderColor: tone.edge,
                boxShadow: `0 0 0 1px ${tone.glow}, 0 0 20px -6px ${tone.glow}`,
              }
            : { borderColor: tone.glow }
          : undefined
      }
    >
      <div className="divide-base-content/8 divide-y">
        <Side
          match={match}
          side="a"
          canReport={canReport && ready}
          onPick={() => pick('a')}
          seriesHint={hintFor('a')}
          tone={tone}
        />
        <Side
          match={match}
          side="b"
          canReport={canReport && ready}
          onPick={() => pick('b')}
          seriesHint={hintFor('b')}
          tone={tone}
        />
      </div>

      {/* The footer names the series and how it stands. With clicking as the
          only input, saying "first to 2" is what makes an incrementing score
          legible — otherwise 1-1 on a Bo3 gives no clue how close it is.

          No reset control here: clicking a name already cycles it back, and a
          separate button for the same gesture was clutter on every card. */}
      {isSeries && (
        <div className="border-base-content/8 bg-base-content/[0.03] flex items-center justify-between border-t px-3 py-1">
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
const ROW = 'relative flex h-11 items-center pr-3 pl-4'

function Side({ match, side, canReport, onPick, seriesHint, tone }) {
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
