import { useRoster } from '@/hooks/useRoster'

/**
 * The single source of truth for who's playing: a plain textarea.
 *
 * There used to be a pill list plus a separate paste box that fed it via an
 * "Add them" button — two controls doing the same job. Now there's one: type
 * or paste names here, one per line or comma separated, and whatever's in the
 * box *is* the player list. A name clicked from the saved roster lands here
 * too, as text, rather than in a list this component no longer has.
 */
export function RosterPicker({ value, onChange, count, glass = false }) {
  // Saved on blur rather than per keystroke — a save on every character
  // would spam the roster with half-typed names.
  const { remember } = useRoster()

  function handleBlur() {
    const names = value
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length) remember(names)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          Players <span className="text-base-content/50">({count})</span>
        </span>
        {/* Always rendered, disabled when there is nothing to clear. Mounting
            it only when the box had text made the header — and so the whole
            container — change height on the first and last keystroke. */}
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={!value.trim()}
          className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30"
        >
          Clear all
        </button>
      </div>

      <textarea
        // `resize-none`: the drag grip is painted by the browser as a square
        // block of diagonal lines that ignores `border-radius`, so it sat over
        // the rounded corner. Hiding it with ::-webkit-resizer did not take, and
        // the box has a fixed row count inside a height-capped column anyway —
        // dragging it taller had nothing to reveal.
        className={`w-full resize-none rounded-xl p-3 text-sm transition-colors focus:outline-none ${
          glass
            ? 'glass-inset focus:border-primary/50 placeholder:text-base-content/35'
            : 'textarea textarea-bordered'
        }`}
        rows={10}
        placeholder={'One name per line, or comma separated\nMark, Daniel, Jacob'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        aria-label="Players"
      />
    </div>
  )
}
