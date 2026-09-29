import { MatchSide } from './MatchSide'

// One match card in a bracket. Used by BracketRound.jsx and RoundList.jsx.
// Reported entirely by clicking a name: a Bo1 resolves on the first click, a
// Bo5 is 4 clicks in the order the games were played.
export function MatchCard({ match, canReport, onReport, onClear, tone }) {
  const decided = Boolean(match.winner)
  const ready = Boolean(match.a && match.b)
  const isSeries = match.best_of > 1

  function pick(side) {
    // Bo1: clicking the current winner undoes it (same gesture as a mis-click fix elsewhere).
    if (!isSeries && decided && match.winner === (side === 'a' ? match.a : match.b)) {
      onClear()
      return
    }

    onReport(side)
  }

  // Hover/title text for a click, for series where it isn't simply "wins".
  function hintFor(side) {
    const label = side === 'a' ? match.a_label : match.b_label

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
    // glass-inset (cheaper blur than glass-panel) — a full bracket has 30+ of these on screen.
    <div
      className="glass-inset overflow-hidden transition-all duration-200"
      style={
        // Every card carries its round's colour; a ready match is lit brightest.
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
        <MatchSide
          match={match}
          side="a"
          canReport={canReport && ready}
          onPick={() => pick('a')}
          seriesHint={hintFor('a')}
          tone={tone}
        />
        <MatchSide
          match={match}
          side="b"
          canReport={canReport && ready}
          onPick={() => pick('b')}
          seriesHint={hintFor('b')}
          tone={tone}
        />
      </div>

      {/* "First to N" makes the score legible since clicking is the only input. */}
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
