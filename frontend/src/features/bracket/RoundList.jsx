import { MatchCard } from './MatchCard'
import { toRounds } from './layout'

/**
 * Round robin and Swiss, as a list of rounds.
 *
 * These formats have no tree to draw — nobody is eliminated and there is no
 * advancement to follow — so a bracket layout would imply a structure that is
 * not there. A grid of fixtures per round is what the host actually reads off
 * while running the night.
 */
export function RoundList({ matches, canReport, onReport = () => {}, onClear = () => {} }) {
  const rounds = toRounds(matches, 'main')

  return (
    <div className="space-y-6">
      {rounds.map(({ roundNo, matches: roundMatches }) => (
        <section key={roundNo}>
          <h3 className="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
            Round {roundNo}
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                canReport={canReport}
                onReport={(side) => onReport(match.id, side)}
                onClear={() => onClear(match.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
