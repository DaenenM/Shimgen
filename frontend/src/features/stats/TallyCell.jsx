import { Minus, Plus } from '@/components/icons'

/**
 * A row of emoji, one per win.
 *
 * The emoji *is* the number here. A crew already keeps this in a chat message —
 * "Brett: 🔱🔱🔱🔱🔱🔱🔱🔱" — and eight tridents read as "well ahead" at a glance
 * in a way the numeral 8 does not. The count is shown alongside once the row
 * gets long, because past a dozen marks nobody is counting glyphs.
 */

/** Past this, the row is summarised rather than drawn mark by mark. */
const MAX_MARKS = 20

export function TallyCell({ count, emoji, canEdit, onAward, busy, display = 'emoji' }) {
  const marks = Math.min(count, MAX_MARKS)
  const overflow = count - marks

  // Games played reaches forty in a season. Drawn as glyphs that is a wall
  // nobody reads, so those columns say the number and skip the marks.
  const asNumber = display === 'number'

  // A number rather than a row of marks: centred under its header, with the
  // same +/- either side so a hand-counted column can still be adjusted. The
  // controls appear on hover, so a table at rest reads as figures rather than
  // a form — but a column fed by a bracket has none at all, since editing one
  // by hand would be overwritten the next time a result was reported.
  if (asNumber) {
    return (
      <div className="flex items-center justify-center gap-1">
        {canEdit && (
          <button
            type="button"
            onClick={() => onAward(-1)}
            disabled={busy || count === 0}
            aria-label="Take one away"
            className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover/row:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0"
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
            className="text-base-content/30 hover:text-primary hover:bg-primary/10 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover/row:opacity-100 focus-visible:opacity-100"
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
            {/* Negative tracking pulls the marks together. An emoji carries a
                wide advance of its own, so at default spacing eight of them
                read as a scattered row rather than the solid block people
                actually write in a chat message. */}
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
          // Beside the add button rather than before the marks, so the emoji
          // start flush against the name and the row reads as a tally. Hidden
          // until the row is hovered: taking a win back is the rare action, and
          // a column of minus buttons makes the board look like a form.
          className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-7 w-7 shrink-0 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover/row:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* The running total, so a long row stays legible. Announced to screen
          readers as the real value, since the emoji above are decorative. */}
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
