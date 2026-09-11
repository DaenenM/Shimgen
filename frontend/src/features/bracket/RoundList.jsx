import { MatchCard } from './MatchCard'
import { roundTone, toRounds } from './layout'

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

  // Swiss and round robin have no final as such, but the last round is still
  // the one that settles it — so the same heat scale applies, counted back
  // from the end exactly as the elimination bracket does.
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
