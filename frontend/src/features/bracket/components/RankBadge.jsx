import { PODIUM } from '../utils/podium'

// Rank marker ("T2" when shared), tinted for the podium. Used by StandingsTable.jsx.
export function RankBadge({ rank, tied = false }) {
  const medal = PODIUM[rank]

  return (
    <span
      className={`tabular grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-1.5 text-xs font-bold ${
        medal ? '' : 'bg-base-content/6 text-base-content/50'
      }`}
      style={
        medal
          ? {
              color: medal.text,
              backgroundColor: medal.wash,
              // Ring keeps silver distinct from the plain grey badges.
              boxShadow: `inset 0 0 0 1.5px color-mix(in oklch, ${medal.text} 60%, transparent)`,
            }
          : undefined
      }
    >
      {tied ? `T${rank}` : rank}
    </span>
  )
}
