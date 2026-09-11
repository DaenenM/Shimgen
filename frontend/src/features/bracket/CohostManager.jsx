import { UserPlus, X } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

import { FriendPicker } from '@/components/ui/FriendPicker'

/**
 * Who else may report results, granted from the bracket itself.
 *
 * The same grant offered when a tournament is created (plan §4, NEW 12), but
 * available once it is running — which is when the need actually shows up. The
 * host is on the far side of the room, someone else is at the console, and
 * handing over the ability to click a winner is faster than relaying scores.
 *
 * A popover rather than a panel: it sits in the header beside the night's other
 * actions, but granting permission is occasional and does not deserve standing
 * space next to Start and Share.
 *
 * Only the creator sees this. A co-host can report results but not pass that
 * right onward — otherwise the person who built the bracket could be given
 * co-hosts they never chose.
 */
export function CohostManager({ cohosts, creatorId, onAdd, onRemove, pending }) {
  const [open, setOpen] = useState(false)
  const container = useRef(null)

  // Only co-hosts are listed and removable. The creator's own role is what
  // makes them the host — showing it here with an X would offer to break the
  // tournament.
  const helpers = cohosts.filter((role) => role.role === 'cohost' && role.user)
  const already = [creatorId, ...helpers.map((role) => role.user.id)].filter(Boolean)

  // Click-away and Escape, so the popover behaves like every other one on the
  // page rather than needing its own button pressed again.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        className="btn btn-outline btn-sm gap-2"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        title="Choose who else can report results"
      >
        <UserPlus className="h-4 w-4" />
        Permissions
        {helpers.length > 0 && <span className="badge badge-sm">{helpers.length}</span>}
      </button>

      {open && (
        <div className="border-base-300 bg-base-100 absolute right-0 z-20 mt-2 w-80 rounded-xl border p-3 shadow-lg">
          <p className="mb-1 text-sm font-medium">Permission to edit</p>
          <p className="text-base-content/50 mb-3 text-xs">
            They can report results and rename this tournament.
          </p>

          {helpers.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-1.5">
              {helpers.map((role) => (
                <li
                  key={role.id}
                  className="bg-base-200 border-base-300 flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-xs"
                >
                  <span className="max-w-[10rem] truncate">{role.user.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(role.user.id)}
                    disabled={pending}
                    className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-5 w-5 place-items-center rounded-full transition-colors"
                    aria-label={`Remove ${role.user.name}`}
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <FriendPicker
            selected={[]}
            exclude={already}
            onToggle={(person) => onAdd(person.id)}
            emptyHint="Add someone as a friend first, then they can help run your brackets."
            allHint="Everyone you've linked with can already help with this one."
          />
        </div>
      )}
    </div>
  )
}
