import { Button } from '@/components/ui/Button'
import { paths } from '@/routes/paths'

import { StandingsTable } from '../StandingsTable'

// Standings plus the one CTA a spectator sees. Used by SpectatorPage.jsx.
export function SpectatorSidebar({ standings, className = '' }) {
  return (
    <aside className={`space-y-4 ${className}`}>
      <div className="glass-panel">
        <div className="py-3">
          <h3 className="mb-1 px-4 text-sm font-semibold">Standings</h3>
          <StandingsTable rows={standings} />
        </div>
      </div>

      {/* This CTA is the acquisition channel (plan §4, NEW 2). */}
      <div className="glass-panel">
        <div className="flex flex-col items-center p-4 text-center">
          <p className="text-base-content/60 text-xs">Running your own game nights?</p>
          <Button to={paths.quickStart} size="sm" className="mt-2">
            New tournament
          </Button>
        </div>
      </div>
    </aside>
  )
}
