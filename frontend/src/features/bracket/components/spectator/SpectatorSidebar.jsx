import { Button } from '@/components/ui/Button'
import { paths } from '@/routes/paths'

import { StandingsTable } from '../StandingsTable'

/** Standings, and the one call to action a spectator sees. */
export function SpectatorSidebar({ standings, className = '' }) {
  return (
    <aside className={`space-y-4 ${className}`}>
      <div className="glass-panel">
        <div className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Standings</h3>
          <StandingsTable rows={standings} />
        </div>
      </div>

      {/* The whole point of a spectator link: someone watching a friend's
          bracket is the best lead this product gets (plan §4, NEW 2). */}
      <div className="glass-panel">
        <div className="flex flex-col items-center p-4 text-center">
          <p className="text-base-content/60 text-xs">Running your own game nights?</p>
          <Button to={paths.quickStart} size="sm" className="mt-2">
            Build a bracket
          </Button>
        </div>
      </div>
    </aside>
  )
}
