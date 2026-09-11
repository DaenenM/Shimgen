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
      <table className="w-full text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
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
            const first = isPlacement ? row.placement === 1 : index === 0

            return (
              <tr
                key={row.entrant_id}
                className={`border-base-content/8 hover:bg-base-content/5 border-b transition-colors last:border-b-0 ${first ? 'bg-accent/10' : ''}`}
              >
                <td
                  className={`tabular ${first ? 'text-accent font-semibold' : 'text-base-content/50'}`}
                >
                  {isPlacement ? row.placement : index + 1}
                </td>
                <td className="font-medium">{row.label}</td>

                {isPlacement ? (
                  <td className="tabular text-right">{ordinal(row.placement)}</td>
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
