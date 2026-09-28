import { Star, Trash2, Users, Zap } from '@/components/icons'
import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

/** One board in the stats list: what it is, who it is shared with, pin and delete. */
export function BoardListItem({ board, onFavourite, onDelete }) {
  return (
    <li className="group hover:bg-base-content/5 relative flex items-center gap-3 px-4 py-3.5 transition-colors duration-150">
      {/* Pinned boards carry a coloured edge, so the ones you chose are
          findable without reading a single row. */}
      {board.favourited_at && (
        <span
          className="bg-warning absolute inset-y-0 left-0 w-1 first:rounded-tl-[1.25rem] last:rounded-bl-[1.25rem]"
          aria-hidden="true"
        />
      )}

      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-bold ${
          board.tracks_tournaments
            ? 'bg-primary/15 text-primary'
            : 'bg-base-content/8 text-base-content/50'
        }`}
        aria-hidden="true"
      >
        {board.name.slice(0, 1).toUpperCase()}
      </span>

      {/* The link covers the row's own area rather than wrapping it, so
          the buttons can sit alongside — a button nested in an anchor is
          invalid and swallows its own clicks. */}
      <Link to={paths.board(board.slug, board.name)} className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{board.name}</span>

          {/* "Shared" means somebody handed you the board; a viewer
              simply appears on it. Saying the wrong one invites a
              person to try editing a board they cannot. */}
          {board.role === 'viewer' ? (
            <span className="bg-base-content/8 text-base-content/60 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
              You&rsquo;re on this
            </span>
          ) : (
            board.role !== 'owner' && (
              <span className="bg-base-content/8 text-base-content/60 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
                Shared
              </span>
            )
          )}
        </span>

        <span className="text-base-content/50 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            {board.player_count} {board.player_count === 1 ? 'player' : 'players'}
          </span>
          <span>
            {board.table_count} {board.table_count === 1 ? 'table' : 'tables'}
          </span>
          {board.tracks_tournaments && (
            <span className="text-primary/70 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Tracks tournaments
            </span>
          )}
          {board.editor_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {board.editor_count}
            </span>
          )}
        </span>
      </Link>

      <button
        onClick={onFavourite}
        aria-label={board.favourited_at ? `Unpin ${board.name}` : `Pin ${board.name} to the top`}
        title={board.favourited_at ? 'Unpin' : 'Pin to the top'}
        // A pinned board keeps its star visible; an unpinned one shows
        // it on hover, so the list reads as boards rather than a column
        // of stars.
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-150 focus-visible:opacity-100 ${
          board.favourited_at
            ? 'text-warning hover:bg-base-content/5 opacity-100'
            : 'text-base-content/40 hover:text-warning hover:bg-base-content/5 opacity-0 group-hover:opacity-100'
        }`}
      >
        <Star className="h-4 w-4" fill={board.favourited_at ? 'currentColor' : 'none'} />
      </button>

      {board.role === 'owner' && (
        <button
          onClick={onDelete}
          aria-label={`Delete ${board.name}`}
          title="Delete board"
          // Revealed on hover so the list reads as boards rather than a
          // column of bins, but always reachable by keyboard.
          className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-9 w-9 shrink-0 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}
