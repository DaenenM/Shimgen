import { Check, Pencil, X } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

/**
 * The tournament's name, editable in place by the host.
 *
 * A typo in a title is noticed once the bracket is on a television and the
 * night has started, which is exactly when the tournament can no longer be
 * recreated. Editing here rather than behind a settings page keeps the fix
 * where the mistake is seen.
 *
 * Renaming is deliberately allowed in every state. Unlike entrants, a title
 * has no structural meaning — nothing advances because of it — so there is no
 * reason to lock it once play begins.
 */
export function EditableTitle({ title, canEdit, onSave, pending }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title ?? '')
  const input = useRef(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const heading = (
    <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
      {title || 'Untitled tournament'}
    </h1>
  )

  if (!canEdit) return heading

  function commit() {
    const next = draft.trim()
    setEditing(false)

    // An unchanged or emptied title is a cancel, not a save: a bracket with a
    // blank name reads as broken, and the placeholder is not a real title.
    if (!next || next === title) {
      setDraft(title ?? '')
      return
    }

    onSave(next)
  }

  if (!editing) {
    return (
      <div className="group flex min-w-0 items-center gap-2">
        {heading}
        <button
          type="button"
          // The draft is seeded here rather than kept in sync by an effect: a
          // batch flush replaces the whole cached tournament, and syncing on
          // every one of those would fight whatever is being typed.
          onClick={() => {
            setDraft(title ?? '')
            setEditing(true)
          }}
          // Revealed on hover so the header reads as a title rather than a
          // form, but always reachable by keyboard.
          className="text-base-content/40 hover:text-base-content hover:bg-base-content/8 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Rename tournament"
          title="Rename tournament"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        ref={input}
        className="glass-inset focus:border-primary/50 h-11 w-full max-w-md px-3 text-xl font-bold transition-colors focus:outline-none sm:text-2xl"
        value={draft}
        autoFocus
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(title ?? '')
            setEditing(false)
          }
        }}
        // Clicking away saves rather than discards: the edit was deliberate,
        // and losing it to a stray click is the more annoying failure.
        onBlur={commit}
        aria-label="Tournament name"
      />

      <button
        type="button"
        onClick={commit}
        disabled={pending}
        className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
        aria-label="Save name"
      >
        <Check className="h-4 w-4" />
      </button>

      <button
        type="button"
        // onMouseDown, not onClick: onBlur fires first and would save the very
        // edit this button exists to discard.
        onMouseDown={(e) => {
          e.preventDefault()
          setDraft(title ?? '')
          setEditing(false)
        }}
        className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-150"
        aria-label="Cancel rename"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
