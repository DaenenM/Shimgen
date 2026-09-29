import { useDragScroll } from '@/hooks/useDragScroll'

import {
  SECTION_LABELS,
  isPhantom,
  roundLabel,
  roundTone,
  sizeFor,
  toRounds,
} from '../../utils/layout'
import { BracketRound } from './BracketRound'

export function BracketSection({ section, matches, showHeading, canReport, onReport, onClear }) {
  // Drag the space between cards to pan. A deep bracket is wider than any
  // screen even after `sizeFor` shrinks it, and hunting for a scrollbar to read
  // your own tournament is the wrong way to spend a game night.
  const scroller = useDragScroll()

  const rounds = toRounds(matches, section)
  if (rounds.length === 0) return null

  const totalRounds = rounds[rounds.length - 1].roundNo

  // Phantom matches are structural placeholders the engine never fills, so
  // nothing is drawn for them — a connector to one would point at empty space.
  //
  // They are *marked*, not removed. A column lays its cards out as equal shares
  // of the column's height, so dropping four of eight leaves the survivors
  // spread across a four-way split while the round beside them is still on an
  // eight-way one — every card off its feeder's midpoint and every arm
  // stretched to reach. That is what a 28-entrant draw looked like: losers
  // round 1 generates eight slots, four of which are fed by a bye that produces
  // no loser, and the four real matches drifted apart.
  //
  // Keeping the slot and rendering nothing in it holds the original grid, so a
  // surviving card stays exactly where its feeders point.
  const columns = rounds
    .map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({
        match,
        hidden: isPhantom(match, matches),
      })),
    }))
    // A round with nothing real left in it goes entirely — that is a dead
    // round, not a gap inside a live one, and reserving space for it would
    // leave an empty column with a heading over it.
    .filter((round) => round.matches.some((slot) => !slot.hidden))

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
            <BracketRound
              key={round.roundNo}
              // Slots, not matches: a column carries its hidden placeholders so
              // the flex shares stay on the grid the connectors were drawn
              // against.
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
function feedersFor(slots, previousSlots) {
  // Both sides arrive as `{ match, hidden }` slots. A hidden feeder is dropped
  // rather than counted: it is a match nobody will play, so an arm from it
  // would be drawn from empty space — which is the whole reason it is hidden.
  // Dropping it is also what turns a pair into the single flat connector a
  // surviving card wants when its partner was a bye.
  const previous = previousSlots.filter((slot) => !slot.hidden).map((slot) => slot.match)

  return slots.map(({ match }) => previous.filter((feeder) => feeder.next_match_win === match.id))
}
