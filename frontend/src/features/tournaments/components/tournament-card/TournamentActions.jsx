import { Archive, ArchiveRestore, RotateCcw, Star, Trash2 } from '@/components/icons'

// Host controls on a tournament row: run back, pin, archive, delete. Used by
// TournamentCard.jsx. Icon buttons with a label on hover/aria-label, not worded buttons.
export function TournamentActions({
  tournament,
  name,
  archived,
  pending,
  onRunBack,
  onFavourite,
  onArchive,
  onRestore,
  onDelete,
}) {
  const pinned = Boolean(tournament.favourited_at)

  return (
    <div className="flex shrink-0 items-center">
      {/* Not offered when archived — that would undo the archiving. */}
      {onRunBack && !archived && (
        <button
          type="button"
          onClick={() => onRunBack(tournament)}
          disabled={pending}
          aria-label={`Run ${name} back as a new tournament`}
          title="Run it back"
          className="text-base-content/35 hover:text-success hover:bg-success/10 group/again grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
        >
          <RotateCcw className="h-4 w-4 transition-transform duration-300 ease-out group-hover/again:-rotate-180" />
        </button>
      )}

      <button
        type="button"
        onClick={() => onFavourite(tournament.id)}
        aria-label={pinned ? `Unpin ${name}` : `Pin ${name} to the top`}
        title={pinned ? 'Unpin' : 'Pin to the top'}
        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
          pinned
            ? 'text-warning hover:bg-warning/10'
            : 'text-base-content/35 hover:text-warning hover:bg-warning/10 sm:opacity-60 sm:group-hover:opacity-100'
        }`}
      >
        <Star className="h-4 w-4" fill={pinned ? 'currentColor' : 'none'} />
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
  )
}
