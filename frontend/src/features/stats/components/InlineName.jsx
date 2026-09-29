import { useState } from 'react'

/**
 * A name editable in place — the board's own, or one of its tables'.
 *
 * Commits on blur as well as Enter: renaming and then clicking straight back
 * into the board is the natural gesture, and losing the edit for want of a
 * keypress is the kind of thing you only notice after it has happened.
 */
export function InlineName({ name, onRename, label, className }) {
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    else setDraft(name)
  }

  return (
    <input
      className={`glass-inset focus:border-primary/50 px-3 transition-colors focus:outline-none ${className}`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(name)
          event.currentTarget.blur()
        }
      }}
      aria-label={label}
    />
  )
}
