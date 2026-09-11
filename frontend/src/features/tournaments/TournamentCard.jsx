import { Archive, ArchiveRestore, Star, Trash2, Trophy } from '@/components/icons'
import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

const FORMAT_LABELS = {
  single: 'Single elimination',
  double: 'Double elimination',
  rr: 'Round robin',
  swiss: 'Swiss',
  ffa: 'Free-for-all',
}

const FORMAT_STYLES = {
  single: 'bg-primary/10 text-primary border border-primary/20',
  double: 'bg-info/10 text-info border border-info/20',
  rr: 'bg-teal-500/10 text-teal-500 border border-teal-500/20',
  swiss: 'bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20',
  ffa: 'bg-warning/10 text-warning border border-warning/20',
}

// One shared shape for every pill in the meta row — format, entrants, and
// winner all read as the same kind of thing now, just with different tones,
// rather than format being a pill and the rest being plain text beside it.
const PILL = 'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium'

const STATE_DOT = {
  draft: 'bg-base-content/30',
  active: 'bg-success',
  complete: 'bg-base-content/40',
}

export function TournamentCard({
  tournament,
  archived = false,
  onFavourite,
  onArchive,
  onRestore,
  onDelete,
  pending = false,
}) {
  const name = tournament.title || 'Untitled tournament'

  return (
    <li className="group bg-base-100 border-base-300 hover:border-base-content/20 relative min-w-0 rounded-xl border transition-colors">
      {tournament.favourited_at && (
        <span
          className="bg-warning absolute inset-y-0 left-0 w-0.5 rounded-l-xl"
          aria-hidden="true"
        />
      )}

      <div className="flex items-center gap-2 py-2.5 pr-2 pl-3.5 sm:gap-3 sm:pr-3 sm:pl-4">
        <Link to={paths.tournament(tournament.id, name)} className="min-w-0 flex-1 py-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                STATE_DOT[tournament.state] ?? STATE_DOT.draft
              }`}
              aria-hidden="true"
            />
            <h3 className="min-w-0 truncate text-[0.9375rem] leading-tight font-semibold">
              {name}
            </h3>
          </div>

          {/* Grid instead of flex: each pill sits in its own column, sized to
              its own content, with a fixed gap between them — so spacing
              stays even whether there are two pills (draft, no winner yet)
              or three (format, entrants, winner). */}
          <div className="mt-1 grid grid-flow-col items-center justify-start gap-1.5 pl-3.5">
            <span className={`${PILL} ${FORMAT_STYLES[tournament.format] ?? 'bg-base-content/10 text-base-content/60 border border-base-content/10'}`}>
              {FORMAT_LABELS[tournament.format] ?? tournament.format}
            </span>

            <span className={`${PILL} bg-base-content/10 text-base-content/60 border border-base-content/10`}>
              {tournament.entrant_count} {tournament.entrant_count === 1 ? 'entrant' : 'entrants'}
            </span>

            {tournament.winner_label ? (
              <span className={`${PILL} bg-accent/10 text-accent border-accent/20 min-w-0 border`}>
                <Trophy className="h-3 w-3 shrink-0" />
                <span className="max-w-28 truncate sm:max-w-40">{tournament.winner_label}</span>
              </span>
            ) : (
              <span className="text-base-content/50 truncate text-xs capitalize">
                {tournament.state}
              </span>
            )}
          </div>
        </Link>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onFavourite(tournament.id)}
            aria-label={tournament.favourited_at ? `Unpin ${name}` : `Pin ${name} to the top`}
            title={tournament.favourited_at ? 'Unpin' : 'Pin to the top'}
            className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
              tournament.favourited_at
                ? 'text-warning hover:bg-warning/10'
                : 'text-base-content/35 hover:text-warning hover:bg-warning/10 sm:opacity-60 sm:group-hover:opacity-100'
            }`}
          >
            <Star className="h-4 w-4" fill={tournament.favourited_at ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            onClick={() => (archived ? onRestore(tournament.id) : onArchive(tournament.id))}
            disabled={pending}
            aria-label={`${archived ? 'Restore' : 'Archive'} ${name}`}
            title={archived ? 'Put it back in the list' : 'Archive'}
            className="text-base-content/35 hover:text-primary hover:bg-primary/10 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
          >
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => onDelete(tournament)}
            aria-label={`Delete ${name}`}
            title="Delete tournament"
            className="text-base-content/35 hover:text-error hover:bg-error/10 grid h-8 w-8 place-items-center rounded-lg transition-colors sm:opacity-60 sm:group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  )
}