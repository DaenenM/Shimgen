import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

import { TournamentActions } from './TournamentActions'
import { TournamentPills } from './TournamentPills'

const STATE_DOT = {
  draft: 'bg-base-content/30',
  drafting: 'bg-success',
  active: 'bg-success',
  complete: 'bg-base-content/40',
}

// One tournament row. Used by TournamentList.jsx, ArchivedTournaments.jsx and
// RecentTournaments.jsx (dashboard).
export function TournamentCard({
  tournament,
  archived = false,
  onFavourite,
  onArchive,
  onRestore,
  onRunBack,
  onDelete,
  pending = false,
  // Dashboard passes this — pinning/archiving/deleting live on the tournaments page instead.
  readOnly = false,
  // The signed-in account, so the row can tell whose tournament this is.
  viewer = null,
}) {
  const name = tournament.title || 'Untitled tournament'

  // An unclaimed quick-start bracket has no owner, so whoever holds it counts as host.
  const isOwner = Boolean(
    tournament.created_by == null || (viewer?.id && tournament.created_by?.id === viewer.id),
  )

  // A drafting tournament has no bracket yet, so it links to the draft lobby instead.
  const isDrafting = tournament.state === 'drafting'
  const target = isDrafting
    ? paths.draft(tournament.id, name)
    : paths.tournament(tournament.id, name)

  return (
    // glass-inset, not glass-panel — dense list rows shouldn't stack as 20 floating cards.
    // A drafting row is lit (green) since it's the one that needs action; other states stay neutral.
    <li
      className={`group relative min-w-0 transition-colors duration-200 ${
        isDrafting
          ? 'border-success/40 bg-success/12 shadow-success/15 rounded-[0.875rem] border shadow-md'
          : 'glass-inset hover:border-base-content/25 hover:bg-base-content/5'
      }`}
    >
      {tournament.favourited_at && (
        <span
          className="bg-warning absolute inset-y-0 left-0 w-0.5 rounded-l-[0.875rem]"
          aria-hidden="true"
        />
      )}

      <div className="flex items-center gap-1.5 py-2.5 pr-1.5 pl-3 sm:gap-3 sm:pr-3 sm:pl-4">
        <Link to={target} className="min-w-0 flex-1 py-0.5">
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

          <TournamentPills tournament={tournament} />
        </Link>

        {/* Owner only — archive/delete/run-back/favourite are all host-gated server-side. */}
        {!readOnly && isOwner && (
          <TournamentActions
            tournament={tournament}
            name={name}
            archived={archived}
            pending={pending}
            onRunBack={onRunBack}
            onFavourite={onFavourite}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        )}
      </div>
    </li>
  )
}
