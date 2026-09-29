import { RotateCcw, Users } from '@/components/icons'

/** The players still to be picked, and the undo for the last pick. */
export function DraftPool({ draft, disabled, onPick, onUndo }) {
  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Available
          <span className="text-base-content/50">({draft.pool.length})</span>
        </span>

        {draft.picks_made > 0 && (
          <button
            type="button"
            onClick={onUndo}
            disabled={disabled}
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30"
            title="Undo the last pick"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>
        )}
      </div>

      {draft.pool.length === 0 ? (
        <p className="text-base-content/50 py-6 text-center text-sm">Everyone has been picked.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {draft.pool.map((name) => (
            // A pick is one tap on the name itself — no select-then-confirm. The
            // draft is the one moment where everyone is watching the screen, and
            // a second step per pick is felt by the whole room.
            <button
              key={name}
              type="button"
              onClick={() => onPick(name)}
              disabled={disabled}
              className="glass-raised hover:border-primary/50 hover:text-primary h-9 rounded-full px-3.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
