import { roundTone, toRounds } from '../utils/layout'
import { MatchCard } from './MatchCard'

// Round robin / Swiss view: a grid of fixtures per round, since those formats
// have no elimination tree to draw. Used by TournamentDetailPage.jsx and SpectatorPage.jsx.
export function RoundList({ matches, canReport, onReport = () => {}, onClear = () => {} }) {
  const rounds = toRounds(matches, 'main')

  // No true "final" here, but the last round still gets the hottest tone.
  const totalRounds = rounds.length > 0 ? rounds[rounds.length - 1].roundNo : 0

  return (
    <div className="space-y-6">
      {rounds.map(({ roundNo, matches: roundMatches }) => (
        <section key={roundNo}>
          <h3 className="mb-3">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase"
              style={{
                color: roundTone(roundNo, totalRounds).color,
                backgroundColor: roundTone(roundNo, totalRounds).wash,
              }}
            >
              Round {roundNo}
            </span>
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                canReport={canReport}
                onReport={(side) => onReport(match.id, side)}
                onClear={() => onClear(match.id)}
                tone={roundTone(roundNo, totalRounds)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
