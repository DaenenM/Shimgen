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

// One bracket section (winners/losers/grand final): its own scroller and column layout.
// Used by BracketView.jsx.
export function BracketSection({ section, matches, showHeading, canReport, onReport, onClear }) {
  // Drag to pan — a deep bracket is wider than any screen even after shrinking.
  const scroller = useDragScroll()

  const rounds = toRounds(matches, section)
  if (rounds.length === 0) return null

  const totalRounds = rounds[rounds.length - 1].roundNo

  // Phantom matches are structural placeholders the engine never fills.
  // Marked hidden rather than removed — removing them would leave the round
  // with fewer slots than its feeders expect, throwing cards off their grid.
  const columns = rounds
    .map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({
        match,
        hidden: isPhantom(match, matches),
      })),
    }))
    // Drop rounds with nothing real left — a dead round, not a gap.
    .filter((round) => round.matches.some((slot) => !slot.hidden))

  // Sized after phantoms are dropped, so it reflects what's actually drawn.
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
        {/* Headings sit above the bracket, not inside the columns, so connector
            lines don't sit a heading's height too low. */}
        {columns.length > 1 && (
          <div className="flex min-w-min">
            {columns.map(({ roundNo }, index) => (
              // One spacer per gap, mirroring the cards below (each connector
              // is drawn once, by the receiving column).
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
              // Slots (not just matches), so hidden placeholders keep the flex grid aligned.
              matches={round.matches}
              // This column draws its own connectors, so it needs to know
              // which previous-column matches feed each of its own.
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

// Which matches in the previous column feed each match in this one, in this
// column's order (so a card and its feeders share the same index).
function feedersFor(slots, previousSlots) {
  // Hidden feeders are dropped, not counted — a bye produces no loser to draw an arm from.
  const previous = previousSlots.filter((slot) => !slot.hidden).map((slot) => slot.match)

  return slots.map(({ match }) => previous.filter((feeder) => feeder.next_match_win === match.id))
}
