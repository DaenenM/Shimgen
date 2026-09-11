import { useDragScroll } from '@/hooks/useDragScroll'

import { MatchCard } from './MatchCard'
import {
  SECTION_LABELS,
  isPhantom,
  roundLabel,
  roundTone,
  sectionsFor,
  sizeFor,
  toRounds,
} from './layout'

/**
 * An elimination bracket, as columns of matches joined by connector lines.
 *
 * Cards shrink as a bracket deepens, and only then. A four-column draw is drawn
 * at full size; a five- or six-column one steps down so the whole shape fits a
 * laptop without side-scrolling — see `SIZES`. Past that the scroller remains,
 * because a phone cannot hold six columns at any size worth reading.
 * Each section (winners, losers, grand final) is its own scroller so the losers
 * bracket does not drag the winners bracket sideways with it.
 *
 * The connectors are drawn with borders rather than SVG. Every pair of cards in
 * a round is wrapped in a flex column that splits the available height evenly,
 * so a card in the next round lands exactly on the midpoint between its two
 * feeders without anything being measured — the browser's own layout does the
 * arithmetic, and it stays right when a card grows a best-of footer.
 */
export function BracketView({ matches, canReport, onReport = () => {}, onClear = () => {} }) {
  const sections = sectionsFor(matches)

  return (
    <div className="space-y-6 sm:space-y-8">
      {sections.map((section) => (
        <BracketSection
          key={section}
          section={section}
          matches={matches}
          showHeading={sections.length > 1}
          canReport={canReport}
          onReport={onReport}
          onClear={onClear}
        />
      ))}
    </div>
  )
}

function BracketSection({ section, matches, showHeading, canReport, onReport, onClear }) {
  // Drag the space between cards to pan. A deep bracket is wider than any
  // screen even after `sizeFor` shrinks it, and hunting for a scrollbar to read
  // your own tournament is the wrong way to spend a game night.
  const scroller = useDragScroll()

  const rounds = toRounds(matches, section)
  if (rounds.length === 0) return null

  const totalRounds = rounds[rounds.length - 1].roundNo

  // Phantom matches are structural placeholders the engine never fills, so
  // they are dropped before anything is drawn — a connector to one would point
  // at empty space.
  const columns = rounds
    .map((round) => ({
      ...round,
      matches: round.matches.filter((match) => !isPhantom(match, matches)),
    }))
    .filter((round) => round.matches.length > 0)

  // Measured after phantoms are dropped, so a losers bracket whose dead rounds
  // are hidden is sized by what is actually drawn rather than by what the
  // engine generated.
  const size = sizeFor(columns.length)

  return (
    <section>
      {showHeading && (
        <h3 className="mb-3">
          <span className="glass-inset text-base-content/70 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            {SECTION_LABELS[section]}
          </span>
        </h3>
      )}

      <div ref={scroller} className="overflow-x-auto pb-2">
        {/* Headings sit in their own row above the bracket. Inside the columns
            they would be part of what the connectors align against, and every
            line would sit a heading's height too low. */}
        {columns.length > 1 && (
          <div className="flex min-w-min">
            {columns.map(({ roundNo }, index) => (
              // One spacer per gap, mirroring the cards below: the join is
              // drawn once by the column that receives it, so a heading row
              // that reserved an arm on both sides drifted right by an arm a
              // round and put the labels over the wrong columns.
              <div key={roundNo} className="flex">
                {index > 0 && <span className={`${size.gap} shrink-0`} />}
                <h4 className={`${size.card} shrink-0 text-center`}>
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase"
                    style={{
                      color: roundTone(roundNo, totalRounds, section).color,
                      backgroundColor: roundTone(roundNo, totalRounds, section).wash,
                    }}
                  >
                    {roundLabel(roundNo, totalRounds, section, index + 1)}
                  </span>
                </h4>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex min-w-min items-stretch">
          {columns.map((round, index) => (
            <Round
              key={round.roundNo}
              matches={round.matches}
              // The column that *receives* draws the whole join, so it needs to
              // know which of the previous column's matches feed each of its
              // own. Splitting the drawing across two columns is what left the
              // halves meeting at different heights.
              feeders={index === 0 ? null : feedersFor(round.matches, columns[index - 1].matches)}
              canReport={canReport}
              onReport={onReport}
              onClear={onClear}
              tone={roundTone(round.roundNo, totalRounds, section)}
              size={size}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Which matches in the previous column feed each match in this one.
 *
 * Returned in this column's own order, so a card and the group that feeds it
 * are looked up by the same index — which is what lets one element draw both
 * halves of a join.
 */
function feedersFor(matches, previous) {
  return matches.map((match) => previous.filter((feeder) => feeder.next_match_win === match.id))
}

/**
 * One column: the arms arriving at it, then its cards.
 *
 * The join is drawn entirely by the receiving column. It used to be split —
 * the previous column drew an elbow out of its own cards, this one drew a stub
 * into its own — and those are two independent flex layouts whose midpoints
 * agree only when a column happens to hold exactly half the cards of the one
 * before it. Where they disagreed the two halves stopped short of each other,
 * which is the floating, unconnected lines.
 *
 * Drawing both halves in one element makes that impossible: the riser and the
 * horizontal that leaves it are siblings in the same box, so they meet by
 * construction at any depth and whatever height a card happens to be.
 */
function Round({ matches, feeders, canReport, onReport, onClear, tone, size }) {
  return (
    <div className="flex items-stretch">
      {feeders && (
        <div className="flex shrink-0 flex-col">
          {matches.map((match, index) => (
            // One slot per card, sharing the column height exactly as the cards
            // do — so whatever vertical this slot centres on is the vertical
            // the card centres on.
            <div key={match.id} className="flex flex-1 items-stretch py-1.5">
              <Connector count={feeders[index]?.length ?? 0} size={size} />
            </div>
          ))}
        </div>
      )}

      <div className={`${size.card} flex shrink-0 flex-col`}>
        {matches.map((match) => (
          // Each card takes an equal share of the column's height and centres
          // itself in it. That is what puts a later round's card level with the
          // midpoint of the group feeding it, at any depth.
          <div key={match.id} className="flex flex-1 items-center py-1.5">
            <div className="w-full">
              <MatchCard
                match={match}
                canReport={canReport}
                onReport={(side) => onReport(match.id, side)}
                onClear={() => onClear(match.id)}
                tone={tone}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const LINE = 'border-base-content/25'

/**
 * The arm arriving at one card.
 *
 * Two arms wide, and the two halves do different jobs. The left arm carries the
 * bracket — corner, riser, corner — spanning from one feeder's centre to the
 * other's. The right arm carries a flat line from the middle of that riser into
 * the card. Without the second arm the riser had nowhere to go: it sat hard
 * against the card with no horizontal reaching it, which is the gap that made
 * the bracket look unfinished.
 *
 * The riser starts and stops at the *feeders'* centres, not at the edges of
 * this slot. The slot spans both feeders, so each half of it holds one, and
 * that feeder's centre is the half's own centre — hence the spacer taking the
 * outer half of each. Spanning the slot edge to edge would overshoot the
 * outermost cards by half a slot at each end.
 */
function Connector({ count, size }) {
  // Nothing upstream — a losers round whose byes were all hidden, say. An arm
  // from nowhere is worse than no arm.
  if (count === 0) return <span className={`${size.gap} shrink-0`} />

  // One feeder: straight across at the card's centre, the full width of the
  // gap. The common case in a losers minor round, and flat is what makes the
  // progression legible.
  if (count === 1) {
    return (
      <span className={`${size.gap} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t`} />
      </span>
    )
  }

  return (
    <span className={`${size.gap} flex shrink-0 items-stretch`}>
      {/* The bracket itself. */}
      <span className={`${size.arm} flex shrink-0 flex-col`}>
        <span className="flex flex-1 flex-col">
          <span className="flex-1" />
          <span className={`${LINE} flex-1 rounded-tr border-t border-r`} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className={`${LINE} flex-1 rounded-br border-r border-b`} />
          <span className="flex-1" />
        </span>
      </span>

      {/* And the run into the card, from the seam between those two halves —
          which is this card's centre line. */}
      <span className={`${size.arm} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t`} />
      </span>
    </span>
  )
}
