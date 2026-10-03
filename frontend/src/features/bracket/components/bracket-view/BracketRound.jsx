import { SLOT_PAD } from '../../utils/layout'
import { MatchCard } from '../MatchCard'
import { RoundConnector } from './RoundConnector'

// One bracket column: connector lines arriving at it, then its match cards.
// Used by BracketSection.jsx. The receiving column draws the whole connector
// (not split across two columns), so lines always meet regardless of column height.
export function BracketRound({ matches, feeders, canReport, onReport, onClear, tone, size }) {
  return (
    <div className="flex items-stretch">
      {feeders && (
        <div className="flex shrink-0 flex-col">
          {matches.map(({ match, hidden }, index) => (
            // One slot per card (hidden slots still take their share, to keep
            // the grid aligned with their feeders). No vertical padding, unlike
            // the card slots — the riser must span exactly this slot's height.
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
          // Equal-height share, centred — aligns each card with the midpoint of its feeders.
          <div key={match.id} className={`flex flex-1 items-center ${SLOT_PAD}`}>
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
