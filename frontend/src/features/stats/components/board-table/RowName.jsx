import { useState } from 'react'

/**
 * A competitor's name, editable in place.
 *
 * Same gesture as the table and board names: commits on blur as well as Enter,
 * because renaming and then clicking straight back into the board is the
 * natural thing to do, and losing the edit for want of a keypress is the kind
 * of thing you only notice afterwards. Escape puts it back.
 *
 * Writes `label`, which is the row's own name. For a row linked to an account
 * that label takes precedence over the account's — so naming a friend something
 * else here is allowed, and that row then stops following their renames. Their
 * tallies and their link are untouched either way.
 */
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
