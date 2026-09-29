import { Archive, ArchiveRestore, Trash2, User, Users } from '@/components/icons'

// One saved player row, active or archived, with actions for its state.
// Used by ArchivedPlayers.jsx, RosterPage.jsx.
export function PlayerRow({ player, archived, onArchive, onRestore, onRemove }) {
  const status = archived ? 'Archived' : null

  const played = player.last_used_at
    ? `last played ${new Date(player.last_used_at).toLocaleDateString()}`
    : null

  const meta = [status, played].filter(Boolean).join(' · ')

  return (
    // Archived rows are dimmed/dashed so the two lists stay visually distinct.
    <li
      className={
        archived
          ? 'border-base-content/12 rounded-xl border border-dashed opacity-70'
          : 'glass-inset'
      }
    >
      <div className="flex flex-row items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 truncate text-sm font-medium ${archived ? 'text-base-content/60' : ''}`}
          >
            <span className="truncate">{player.display_name}</span>

            {player.is_friend ? (
              <Users className="text-primary h-3.5 w-3.5 shrink-0" aria-label="Friend" role="img" />
            ) : (
              // Linked-but-not-friend (e.g. claimed a bracket) uses accent color, not friend blue.
              player.linked && (
                <User
                  className="text-accent h-3.5 w-3.5 shrink-0"
                  aria-label="Linked account"
                  role="img"
                />
              )
            )}
          </p>
          {meta && <p className="text-base-content/50 text-xs">{meta}</p>}
        </div>

        <div className="flex gap-1">
          {archived ? (
            <button
              className="bg-primary text-primary-content hover:bg-primary/90 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150"
              onClick={onRestore}
              title="Put them back on the roster"
              aria-label={`Restore ${player.display_name}`}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore
            </button>
          ) : (
            <button
              className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
              onClick={onArchive}
              title="Archive: hides them without losing their history"
              aria-label={`Archive ${player.display_name}`}
            >
              <Archive className="h-4 w-4" />
            </button>
          )}

          {/* Delete only offered for a plain typed name; a friend/self row would cascade-delete rating history. */}
          {!player.is_friend && !player.is_self && (
            <button
              className="text-error hover:bg-error/10 inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
              onClick={onRemove}
              title="Delete permanently"
              aria-label={`Delete ${player.display_name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
