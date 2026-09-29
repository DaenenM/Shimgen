import { MatchCard } from '../MatchCard'
import { RoundConnector } from './RoundConnector'

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
export function BracketRound({ matches, feeders, canReport, onReport, onClear, tone, size }) {
  return (
    <div className="flex items-stretch">
      {feeders && (
        <div className="flex shrink-0 flex-col">
          {matches.map(({ match, hidden }, index) => (
            // One slot per card, sharing the column height exactly as the cards
            // do — so whatever vertical this slot centres on is the vertical
            // the card centres on. A hidden slot still takes its share, which
            // is what keeps the cards around it on the grid their feeders were
            // drawn against.
            //
            // No vertical padding here, unlike the card slots beside it. The
            // riser has to span from one feeder card's midpoint to the other's,
            // and those two cards sit in slots half this one's height — so the
            // gap between their centres is exactly this slot's full height.
            // Padding this slot shortened the riser by 3px at each end while
            // the cards stayed put, which is what left the corners sitting
            // inside the cards' midlines instead of on them.
            <div key={match.id} className="flex flex-1 items-stretch">
              {hidden ? (
                <span className={`${size.gap} shrink-0`} />
              ) : (
                <RoundConnector count={feeders[index]?.length ?? 0} size={size} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className={`${size.card} flex shrink-0 flex-col`}>
        {matches.map(({ match, hidden }) => (
          // Each card takes an equal share of the column's height and centres
          // itself in it. That is what puts a later round's card level with the
          // midpoint of the group feeding it, at any depth.
          <div key={match.id} className="flex flex-1 items-center py-1.5">
            {!hidden && (
              <div className="w-full">
                <MatchCard
                  match={match}
                  canReport={canReport}
                  onReport={(side) => onReport(match.id, side)}
                  onClear={() => onClear(match.id)}
                  tone={tone}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
