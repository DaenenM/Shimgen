import { Trophy } from '@/components/icons'

import { StandingsTable } from './StandingsTable'

// Standings block with heading. Used by TournamentDetailPage.jsx.
export function StandingsSection({ rows }) {
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg">
        <Trophy className="text-accent h-4.5 w-4.5 sm:h-5 sm:w-5" />
        Standings
      </h2>
      <p className="text-base-content/60 mb-3 text-sm sm:mb-4">How everyone is placed so far.</p>

      <div className="glass-panel overflow-hidden">
        {/* No inner padding — the table pads its own cells. */}
        <div className="py-1">
          <StandingsTable rows={rows} />
        </div>
      </div>
    </section>
  )
}
