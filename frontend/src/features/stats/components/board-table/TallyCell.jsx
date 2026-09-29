import { Minus, Plus } from '@/components/icons'

// Renders a tally as a row of emoji marks (or a number). Used by BoardRow.jsx.
// Past MAX_MARKS the count is shown as "+N" instead of drawing every glyph.
const MAX_MARKS = 20

export function TallyCell({ count, emoji, canEdit, onAward, busy, display = 'emoji' }) {
  const marks = Math.min(count, MAX_MARKS)
  const overflow = count - marks

  // High counts (e.g. games played) are unreadable as glyphs, so those columns use numbers.
  const asNumber = display === 'number'

  // +/- controls show on hover on desktop, but always on mobile (no hover there).
  if (asNumber) {
    return (
      <div className="flex items-center justify-center gap-1">
        {canEdit && (
          <button
            type="button"
            onClick={() => onAward(-1)}
            disabled={busy || count === 0}
            aria-label="Take one away"
            className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-6 w-6 shrink-0 place-items-center rounded-md transition-all duration-150 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 sm:opacity-0 sm:group-hover/row:opacity-100"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}

        <span
          className={`tabular w-6 text-center text-sm font-bold ${
            count === 0 ? 'text-base-content/25' : 'text-base-content'
          }`}
        >
          {count}
        </span>

        {canEdit && (
          <button
            type="button"
            onClick={() => onAward(1)}
            disabled={busy}
            aria-label="Add one"
            className="text-base-content/30 hover:text-primary hover:bg-primary/10 grid h-6 w-6 shrink-0 place-items-center rounded-md transition-all duration-150 focus-visible:opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1">
        {asNumber ? null : count === 0 ? (
          <span className="text-base-content/25 text-sm">0</span>
        ) : (
          <>
            {/* Negative letter-spacing pulls emoji together into a solid block. */}
            <span
              className="text-lg leading-none [letter-spacing:-0.15em] break-all"
              aria-hidden="true"
            >
              {emoji.repeat(marks)}
            </span>
            {overflow > 0 && (
              <span className="text-base-content/50 ml-2 text-xs font-semibold">+{overflow}</span>
            )}
          </>
        )}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={() => onAward(-1)}
          disabled={busy || count === 0}
          aria-label="Take one away"
          // Hidden until row hover: a visible column of minus buttons looks like a form.
          className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all duration-150 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 sm:opacity-0 sm:group-hover/row:opacity-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Numeric total for long rows; emoji above are aria-hidden/decorative. */}
      <span
        className={`tabular w-8 shrink-0 text-right text-sm font-bold ${
          count === 0 ? 'text-base-content/25' : 'text-base-content'
        }`}
      >
        {count}
      </span>

      {canEdit && (
        <button
          type="button"
          onClick={() => onAward(1)}
          disabled={busy}
          aria-label="Add one"
          className="bg-primary/10 text-primary hover:bg-primary/25 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
