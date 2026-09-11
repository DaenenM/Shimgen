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
export function RosterPicker({ value, onChange, count }) {
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
        {value.trim() && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange('')}>
            Clear all
          </button>
        )}
      </div>

      <textarea
        className="textarea textarea-bordered w-full rounded-xl text-sm"
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