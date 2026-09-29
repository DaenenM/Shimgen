import { useDragScroll } from '@/hooks/useDragScroll'

// Podium colours. Gold reuses `--color-accent` (the app's existing victory colour)
// rather than a second gold. Silver/bronze use the same light-dark() pattern so
// all three invert with the theme.
const PODIUM = {
  1: {
    text: 'var(--color-accent)',
    wash: 'color-mix(in oklch, var(--color-accent) 14%, transparent)',
    edge: 'var(--color-accent)',
  },
  2: {
    text: 'light-dark(oklch(52% 0.02 260), oklch(84% 0.02 260))',
    wash: 'light-dark(oklch(52% 0.02 260 / 0.12), oklch(84% 0.02 260 / 0.13))',
    edge: 'light-dark(oklch(52% 0.02 260), oklch(84% 0.02 260))',
  },
  3: {
    text: 'light-dark(oklch(50% 0.09 50), oklch(74% 0.10 50))',
    wash: 'light-dark(oklch(50% 0.09 50 / 0.12), oklch(74% 0.10 50 / 0.14))',
    edge: 'light-dark(oklch(50% 0.09 50), oklch(74% 0.10 50))',
  },
}

// Standings table. Renders whichever shape the API returned: points-based rows
// (round robin, Swiss) or a placement per entrant (knockout, ranked by how far you got).
// Used by StandingsSection.jsx and SpectatorSidebar.jsx.
export function StandingsTable({ rows }) {
  // Before the early return: hooks can't be conditional.
  const scroller = useDragScroll()

  if (!rows || rows.length === 0) {
    return (
      <p className="text-base-content/60 py-6 text-center text-sm">
        Standings appear once results are in.
      </p>
    )
  }

  const isPlacement = rows[0].placement !== undefined

  return (
    <div ref={scroller} className="overflow-x-auto">
      {/* Padding via child selectors instead of repeating a class on every cell. */}
      <table className="w-full text-sm [&_td]:px-2.5 [&_td]:py-2 sm:[&_td]:px-3 [&_th]:px-2.5 [&_th]:py-2 sm:[&_th]:px-3">
        <thead>
          <tr className="border-base-content/10 text-base-content/60 border-b text-xs font-semibold tracking-wide uppercase">
            <th className="w-10">#</th>
            <th>Entrant</th>
            {isPlacement ? (
              <th className="text-right">Finish</th>
            ) : (
              <>
                <th className="text-right">P</th>
                <th className="text-right">W</th>
                <th className="text-right">D</th>
                <th className="text-right">L</th>
                <th className="text-right">Pts</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            // Medal comes from placement itself, not row position — several entrants
            // can share a placement (four quarter-finalists are all 5th).
            const rank = isPlacement ? row.placement : index + 1
            const medal = PODIUM[rank]

            return (
              <tr
                key={row.entrant_id}
                className="border-base-content/8 hover:bg-base-content/5 relative border-b transition-colors last:border-b-0"
                style={medal ? { backgroundColor: medal.wash } : undefined}
              >
                <td className="tabular relative">
                  {/* Lit edge instead of heavier fill, so three tinted rows don't swamp the table. */}
                  {medal && (
                    <span
                      className="absolute inset-y-0 left-0 w-0.5"
                      style={{ backgroundColor: medal.edge }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={medal ? 'font-bold' : 'text-base-content/50'}
                    style={medal ? { color: medal.text } : undefined}
                  >
                    {rank}
                  </span>
                </td>
                <td className="font-medium" style={medal ? { color: medal.text } : undefined}>
                  {row.label}
                </td>

                {isPlacement ? (
                  <td
                    className={`tabular text-right ${medal ? 'font-semibold' : ''}`}
                    style={medal ? { color: medal.text } : undefined}
                  >
                    {ordinal(row.placement)}
                  </td>
                ) : (
                  <>
                    {/* Played is a volume, not a verdict, so it stays neutral. */}
                    <td className="tabular text-base-content/70 text-right">{row.played}</td>
                    <td className="tabular text-success text-right">{row.wins}</td>
                    <td className="tabular text-base-content/70 text-right">{row.draws}</td>
                    <td className="tabular text-error/85 text-right">{row.losses}</td>
                    <td className="tabular text-right font-semibold">{row.points}</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ordinal(n) {
  // 11th-13th are exceptions to the naive last-digit rule.
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`

  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}
