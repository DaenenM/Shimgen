import { roundTone } from '../../utils/layout'
import { BracketRound } from './BracketRound'

// A section's match columns with their connectors. Used by BracketSection.jsx and DoubleEliminationLayout.jsx.
export function RoundColumns({
  columns,
  totalRounds,
  size,
  section,
  canReport,
  onReport,
  onClear,
}) {
  return (
    <div className="flex min-w-min items-stretch">
      {columns.map((round, index) => (
        <BracketRound
          key={round.roundNo}
          matches={round.matches}
          feeders={index === 0 ? null : feedersFor(round.matches, columns[index - 1].matches)}
          canReport={canReport}
          onReport={onReport}
          onClear={onClear}
          tone={roundTone(round.roundNo, totalRounds, section)}
          size={size}
        />
      ))}
    </div>
  )
}

// Previous-column matches feeding each match here, in this column's order.
// Hidden feeders are dropped — a bye produces no loser to draw an arm from.
function feedersFor(slots, previousSlots) {
  const previous = previousSlots.filter((slot) => !slot.hidden).map((slot) => slot.match)

  return slots.map(({ match }) => previous.filter((feeder) => feeder.next_match_win === match.id))
}
