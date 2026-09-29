import { useState } from 'react'

// Editable-in-place name field for a board or table. Used by BoardHeader.jsx and TableCard.jsx.
// Commits on blur too, so clicking away doesn't lose the edit.
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
