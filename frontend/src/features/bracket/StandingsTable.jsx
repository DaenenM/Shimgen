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
      <table className="table">
        <thead>
          <tr>
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
          {rows.map((row, index) => (
            <tr key={row.entrant_id} className="hover">
              <td className="text-base-content/50 tabular">
                {isPlacement ? row.placement : index + 1}
              </td>
              <td className="font-medium">{row.label}</td>

              {isPlacement ? (
                <td className="tabular text-right">{ordinal(row.placement)}</td>
              ) : (
                <>
                  <td className="tabular text-right">{row.played}</td>
                  <td className="tabular text-right">{row.wins}</td>
                  <td className="tabular text-right">{row.draws}</td>
                  <td className="tabular text-right">{row.losses}</td>
                  <td className="tabular text-right font-semibold">{row.points}</td>
                </>
              )}
            </tr>
          ))}
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
