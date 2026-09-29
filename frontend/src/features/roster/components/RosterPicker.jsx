import { useAutoSaveRoster } from '../hooks/useAutoSaveRoster'
import { useRoster } from '../hooks/useRoster'

// Plain textarea that is the single source of truth for who's playing.
// Used by EntrantsPanel.jsx, TeamSetupPanel.jsx.
// Whatever text is in the box *is* the player list (one name per line or comma-separated).
export function RosterPicker({ value, onChange, count, glass = false, onClear }) {
  const { remember } = useRoster()
  const [autoSave] = useAutoSaveRoster()

  function handleBlur() {
    // Save on blur, not per keystroke, to avoid spamming the roster with half-typed names.
    if (!autoSave) return
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
        {/* Always rendered (disabled when empty) to avoid the header resizing on first/last keystroke. */}
        {/* `onClear` lets a caller also reset downstream state (e.g. generated teams); falls back to clearing the text. */}
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          disabled={!value.trim()}
          className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30"
        >
          Clear all
        </button>
      </div>

      <textarea
        // `resize-none`: the native resize grip ignores border-radius and overlaps the rounded corner.
        // `text-base-content` explicit: index.css's muted-text rule matches the
        // `placeholder:text-base-content/35` class substring and would otherwise dim typed text too.
        className={`w-full resize-none rounded-xl p-3 text-sm leading-relaxed transition-colors focus:outline-none ${
          glass
            ? 'glass-inset text-base-content focus:border-primary/50 placeholder:text-base-content/45 font-medium'
            : 'textarea textarea-bordered text-base-content font-medium'
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
