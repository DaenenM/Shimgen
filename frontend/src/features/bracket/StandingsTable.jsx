/**
 * The podium.
 *
 * Gold is `--color-accent` rather than a colour of its own: hue 80 is already
 * the app's victory colour — the winner pill on a tournament card, the trophy
 * on the bracket — and a second, slightly different gold beside it would read
 * as a mistake.
 *
 * Silver and bronze are built to match, on the same `light-dark()` pattern the
 * format pills and round tones use, so all three invert with the theme instead
 * of being pastel on white and muddy on black.
 *
 * Silver is deliberately almost colourless — hue 260 at 0.02 chroma. Any more
 * and it reads as blue, which collides with `--color-primary`; any less and it
 * is indistinguishable from the neutral rows around it.
 */
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

/**
 * Standings.
 *
 * The API returns one of two shapes depending on format: points-based rows for
 * round robin, Swiss and FFA, or a placement per entrant for a knockout — where
 * ranking by points would be meaningless, since a bracket ranks by how far you
 * got. This renders whichever arrived.
 */
export function StandingsTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-base-content/60 py-6 text-center text-sm">
        Standings appear once results are in.
      </p>
    )
  }

  const isPlacement = rows[0].placement !== undefined

  return (
    <div className="overflow-x-auto">
      {/* Padding is applied with child selectors rather than a class on every
          one of the dozen cells — DaisyUI's `table` was supplying it before,
          and repeating `px-3 py-2` twelve times is how the next column added
          ends up misaligned. */}
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
            // First place, however this table is ranked. On a knockout that is
            // the champion; on points it is whoever leads. Either way it is the
            // line the table was opened to find, so it gets the victory colour
            // and nothing else does.
            // A knockout ranks by how far you got, and several entrants
            // genuinely share a placement — four quarter-finalists are all
            // 5th. So the medal comes from the placement itself, not from
            // where the row happens to sit in the list.
            const rank = isPlacement ? row.placement : index + 1
            const medal = PODIUM[rank]

            return (
              <tr
                key={row.entrant_id}
                className="border-base-content/8 hover:bg-base-content/5 relative border-b transition-colors last:border-b-0"
                style={medal ? { backgroundColor: medal.wash } : undefined}
              >
                <td className="tabular relative">
                  {/* A lit edge rather than a heavier fill: three tinted rows
                      stacked would otherwise swamp the table, and the edge is
                      what keeps the podium readable at a glance. */}
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
                    {/* Played is a volume, not a verdict, so it stays neutral —
                        colouring it would rank turning up alongside winning. */}
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
  // 11th, 12th and 13th are the exceptions the naive rule gets wrong.
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`

  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}
