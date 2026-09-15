import { Check, ChevronDown } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

/**
 * Pick one name from a list of names.
 *
 * Extracted from the team generator, where it picks the two players in a rule,
 * so the captain picker on the new-tournament form can use the same control
 * rather than growing a second dropdown that behaves almost-but-not-quite the
 * same. Both do the same job: choose a person out of the names already typed.
 *
 * `taken` greys out names chosen elsewhere without removing them. A list that
 * reshuffles as you pick moves the option under the cursor — and when this is
 * used once per team, every pick would rearrange every other dropdown.
 *
 * `onOpenChange(label, open)` reports upward because the fix for an open list
 * being covered usually lives on an ancestor: a `backdrop-filter` anywhere
 * above creates a stacking context, and a z-index set here is sealed inside it.
 * Parents raise themselves while a list is open. It reports *which* select
 * moved, not merely that one did — clicking from one open list straight to
 * another runs a close and an open in the same commit, and a bare boolean
 * records whichever effect happened to run last.
 */
export function PlayerSelect({
  value,
  onChange,
  names,
  label,
  placeholder = 'Player',
  disabled = false,
  taken = [],
  onOpenChange,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    onOpenChange?.(label, open)
  }, [open, onOpenChange, label])

  useEffect(() => {
    function onClickAway(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }

    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="glass-inset hover:border-base-content/25 flex h-9 w-full min-w-0 items-center justify-between gap-1.5 px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${value ? '' : 'text-base-content/40'}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`text-base-content/40 h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="glass-raised absolute z-10 mt-1.5 max-h-48 w-full overflow-auto py-1"
        >
          {names.length === 0 ? (
            <li className="text-base-content/50 px-3 py-2 text-sm">No names yet.</li>
          ) : (
            names.map((name) => {
              const isMine = name === value
              // Taken by another select. Shown rather than hidden so the list
              // stays in the same order for everyone.
              const isTaken = !isMine && taken.includes(name)

              return (
                <li key={name} role="option" aria-selected={isMine}>
                  <button
                    type="button"
                    disabled={isTaken}
                    onClick={() => {
                      onChange(name)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-30 ${
                      isMine ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-base-200/60'
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    {isMine && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {isTaken && (
                      <span className="text-base-content/40 shrink-0 text-xs">captain</span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
