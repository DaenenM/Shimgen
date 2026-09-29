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

export function TournamentCard({
  tournament,
  archived = false,
  onFavourite,
  onArchive,
  onRestore,
  onRunBack,
  onDelete,
  pending = false,
  // A glance rather than a workbench — the dashboard shows the same row but
  // keeps pinning, archiving and deleting on the tournaments page, which is one
  // tap away. Without this the row would render three controls wired to
  // handlers the caller never passed.
  readOnly = false,
  // The signed-in account, so the row can tell whose tournament this is.
  viewer = null,
}) {
  const name = tournament.title || 'Untitled tournament'

  // Matches how the bracket page decides the same thing. An unclaimed
  // quick-start bracket has no owner at all, and whoever is holding it is
  // effectively its host — the same bargain the server strikes.
  const isOwner = Boolean(
    tournament.created_by == null || (viewer?.id && tournament.created_by?.id === viewer.id),
  )

  // A drafting tournament has no bracket yet, so the bracket page would show an
  // empty one — the lobby is where it actually continues, for a captain about
  // to pick and for anyone watching alike.
  const isDrafting = tournament.state === 'drafting'
  const target = isDrafting
    ? paths.draft(tournament.id, name)
    : paths.tournament(tournament.id, name)

  return (
    // `glass-inset` rather than `glass-panel`: these are dense list rows, and
    // a full panel's blur plus drop shadow, stacked twenty deep, reads as
    // twenty floating cards instead of one list.
    // A draft in progress is the one row somebody has to act on, so it is lit
    // rather than tinted: a green ground and a matching edge, against rows that
    // are all the same neutral glass. Everything else keeps the quiet treatment
    // — colour every state and none of them stands out.
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

        {/* Owner only. Archiving, deleting and running back are all gated on
            IsTournamentHost server-side, so for anybody else these were three
            buttons that could only ever return 403 — which is exactly what they
            did for a player looking at a tournament somebody else hosts.

            The list shows tournaments you play in as well as ones you run, so
            this is the common case, not an edge one. Pinning goes with them:
            `favourite` is host-gated too. */}
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
