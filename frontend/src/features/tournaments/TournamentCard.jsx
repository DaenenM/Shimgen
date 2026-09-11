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

/**
 * State as a dot rather than a pill.
 *
 * A row of coloured badges competes with the titles beside them for attention,
 * and "draft / active / complete" is three states — a legend the eye learns in
 * one glance. The dot carries the colour and the word rides with it in muted
 * text, so the card reads as a name first and a status second.
 */
const STATE_DOT = {
  draft: 'bg-base-content/30',
  // Green for live, not the brand blue. Blue is what a control looks like
  // everywhere else on the page, so a blue dot read as something to press.
  active: 'bg-success',
  // The trophy beside it carries "finished"; a second colour here would only
  // compete with it.
  complete: 'bg-base-content/40',
}

/**
 * One tournament in the list.
 *
 * Deliberately one row on every screen size, not a stacked block on phones.
 * The earlier version gave actions their own divided row underneath, which made
 * each card about ninety pixels tall — three of them filled a phone screen and
 * the list stopped being scannable. Everything here fits on one line because
 * the meta is short and the actions are a fixed 3×32px cluster.
 */
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
      {/* Pinned tournaments carry a coloured edge, so the ones chosen are
          findable without reading a single row. */}
      {tournament.favourited_at && (
        <span
          className="bg-warning absolute inset-y-0 left-0 w-0.5 rounded-l-xl"
          aria-hidden="true"
        />
      )}

      <div className="flex items-center gap-2 py-2.5 pr-2 pl-3.5 sm:gap-3 sm:pr-3 sm:pl-4">
        {/* The link covers its own area rather than wrapping the card, so the
            action buttons can sit alongside — a button nested in an anchor is
            invalid and swallows its own clicks. */}
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

          {/* One muted line. The winner is the part worth reading on a
              finished night, so it is `shrink-0` and the format/entrant text
              gives way first — truncating the winner off the end, which is
              what happens if both sides are allowed to shrink, loses the only
              thing that distinguishes one completed row from another.

              The state word is dropped once there is a winner: "Complete" next
              to a trophy is saying the same thing twice in a line with no room
              to spare. */}
          <p className="text-base-content/60 mt-1 flex min-w-0 items-center gap-1.5 pl-3.5 text-xs">
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium ${
                FORMAT_STYLES[tournament.format] ?? 'bg-base-content/10 text-base-content/60'
              }`}
            >
              {FORMAT_LABELS[tournament.format] ?? tournament.format}
            </span>

            <span className="min-w-0 truncate">
              {tournament.entrant_count} {tournament.entrant_count === 1 ? 'entrant' : 'entrants'}
              {!tournament.winner_label && (
                <>
                  {' · '}
                  <span className="capitalize">{tournament.state}</span>
                </>
              )}
            </span>

            {tournament.winner_label && (
              <span className="text-accent flex min-w-0 shrink-0 items-center gap-1 font-medium">
                <Trophy className="h-3 w-3 shrink-0" />
                <span className="max-w-28 truncate sm:max-w-40">{tournament.winner_label}</span>
              </span>
            )}
          </p>
        </Link>

        {/* Always visible on touch — `group-hover` never fires on a phone, so
            hiding these behind it made every action on this page unreachable
            there. Dimmed rather than hidden on desktop, which keeps the list
            calm without making the controls a secret. */}
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

          {/* Archive before delete, and the softer of the two: for a finished
              season it is almost always the one the host actually wants. */}
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
