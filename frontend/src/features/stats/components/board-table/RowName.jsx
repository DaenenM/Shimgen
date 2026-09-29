import { useState } from 'react'

// A competitor's name, editable in place. Used by BoardRow.jsx.
// Commits on blur too (same as InlineName). Writes the row's own label, which
// overrides a linked account's name and detaches it from that account's renames.
export function RowName({ name, onRename }) {
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    else setDraft(name)
  }

  return (
    <input
      className="glass-inset focus:border-primary/50 h-7 w-full min-w-0 px-2 text-sm font-medium transition-colors focus:outline-none"
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
      aria-label={`Rename ${name}`}
    />
  )
}
