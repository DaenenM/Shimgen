import { Eye } from '@/components/icons'

import { FORMAT_LABELS } from '../../utils/layout'

/** The public bracket's title block: what it is, how big, and whether it is live. */
export function SpectatorHeader({ tournament, className = '' }) {
  const live = tournament.state === 'active'

  return (
    <div className={className}>
      <div className="glass-inset text-base-content/60 mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
        <Eye className="h-3.5 w-3.5" />
        Spectator view
      </div>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {tournament.title || 'Tournament'}
      </h1>
      <p className="text-base-content/60 mt-1 text-sm">
        {FORMAT_LABELS[tournament.format] ?? tournament.format} · {tournament.entrants.length}{' '}
        entrants
        <span
          className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
            live ? 'bg-success/15 text-success' : 'bg-base-content/8 text-base-content/60'
          }`}
        >
          {live && <span className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />}
          {tournament.state}
        </span>
      </p>

      {tournament.description && (
        <p className="text-base-content/70 mt-3 text-sm">{tournament.description}</p>
      )}
    </div>
  )
}
