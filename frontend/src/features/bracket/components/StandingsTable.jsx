import { PODIUM } from '../utils/podium'
import { RankBadge } from './RankBadge'

// Standings list: placement rows for knockouts, record + points for round robin/Swiss.
// Used by StandingsSection.jsx and SpectatorSidebar.jsx. Built to fit a narrow (~20rem) column.
export function StandingsTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-base-content/60 py-6 text-center text-sm">
        Standings appear once results are in.
      </p>
    )
  }

  const isPlacement = rows[0].placement !== undefined
  // Draws only exist in some round robins; hide the column otherwise.
  const hasDraws = !isPlacement && rows.some((row) => row.draws > 0)
  const ranks = rankRows(rows, isPlacement)

  return (
    <div>
      {!isPlacement && (
        <div className="text-base-content/45 flex items-center gap-3 px-4 pt-2 pb-1 text-[0.7rem] font-semibold tracking-wide uppercase">
          <span className="w-7 shrink-0" />
          <span className="min-w-0 flex-1">Entrant</span>
          <span className="w-14 shrink-0 text-right">{hasDraws ? 'W-D-L' : 'W-L'}</span>
          <span className="w-9 shrink-0 text-right">Pts</span>
        </div>
      )}

      <ol className="divide-base-content/6 divide-y">
        {rows.map((row, index) => {
          const { rank, tied } = ranks[index]
          const medal = PODIUM[rank]

          return (
            <li
              key={row.entrant_id}
              className="hover:bg-base-content/4 flex items-center gap-3 px-4 py-2 transition-colors"
            >
              <RankBadge rank={rank} tied={tied} />

              <span
                className={`min-w-0 flex-1 truncate text-sm ${medal ? 'font-semibold' : 'font-medium'}`}
                style={medal ? { color: medal.text } : undefined}
                title={row.label}
              >
                {row.label}
              </span>

              {!isPlacement && (
                <>
                  <span className="tabular text-base-content/55 w-14 shrink-0 text-right text-xs">
                    {hasDraws
                      ? `${row.wins}-${row.draws}-${row.losses}`
                      : `${row.wins}-${row.losses}`}
                  </span>
                  <span className="tabular w-9 shrink-0 text-right text-sm font-bold">
                    {row.points}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// Each row's rank and whether it's shared. Knockouts share by placement (four quarter-finalists
// are all 5th); points tables share when points and every tiebreaker are level.
function rankRows(rows, isPlacement) {
  const ranks = rows.map((row, index) => {
    if (isPlacement) return row.placement
    const prev = rows[index - 1]
    const level =
      prev && prev.points === row.points && prev.buchholz === row.buchholz && prev.wins === row.wins
    return level ? null : index + 1
  })
  // A level row inherits the rank above it.
  for (let i = 0; i < ranks.length; i += 1) ranks[i] ??= ranks[i - 1]

  return ranks.map((rank) => ({ rank, tied: ranks.filter((r) => r === rank).length > 1 }))
}
