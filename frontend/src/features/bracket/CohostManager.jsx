import { useQuery } from '@tanstack/react-query'
import { Check, Plus, UserPlus, Users, X } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { friends as friendsApi } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

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
 * One list, not two. This used to stack a row of removable pills above a
 * separate picker, so the same person appeared in one place or the other
 * depending on state, and granting and revoking were two different gestures in
 * two different shapes. Every friend now has exactly one row that toggles —
 * the same pattern as the saved roster, where a tick means "in" and becomes a
 * cross on hover to say what the click will do.
 *
 * Only the creator sees this. A co-host can report results but not pass that
 * right onward — otherwise the person who built the bracket could be given
 * co-hosts they never chose.
 */
export function CohostManager({ cohosts, creatorId, onAdd, onRemove, pending }) {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const container = useRef(null)

  // Only co-hosts are listed and removable. The creator's own role is what
  // makes them the host — offering to remove it would break the tournament.
  const helpers = cohosts.filter((role) => role.role === 'cohost' && role.user)
  const granted = new Set(helpers.map((role) => role.user.id))

  // Asked for only once the popover is open: a bracket page should not fetch a
  // friends list nobody has looked at.
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
    enabled: open && isAuthenticated,
  })

  // A friendship is stored directionally, so which side is "them" depends on
  // who sent the original request.
  const friends = (data ?? [])
    .map((item) => (item.direction === 'outgoing' ? item.to_user : item.from_user))
    .filter((person) => person && person.id !== creatorId)

  // Anyone already helping is shown even if the friendship has since gone —
  // they still hold the permission, so there has to be a way to take it back.
  const orphaned = helpers
    .map((role) => role.user)
    .filter((person) => !friends.some((friend) => friend.id === person.id))

  const people = [...friends, ...orphaned].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  )

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
    <div className="static sm:relative" ref={container}>
      <button
        type="button"
        className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] sm:px-4"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Permissions"
        title="Choose who else can report results"
      >
        <UserPlus className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Permissions</span>
      </button>

      {open && (
        <div className="glass-raised absolute inset-x-0 top-full z-20 mt-2 p-3 sm:inset-x-auto sm:right-0 sm:w-72">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4" />
            Permission to edit
          </span>
          <p className="text-base-content/50 mt-0.5 mb-3 text-xs">
            {people.length === 0
              ? 'They can report results and rename this tournament.'
              : 'Click a name to give or take away access.'}
          </p>

          {isLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : people.length === 0 ? (
            // Two different empty states. Having no friends at all is worth a
            // prompt to go and add one; having none left to add is just done,
            // and telling that person to "add a friend first" reads as a bug.
            <div className="border-base-content/10 rounded-xl border border-dashed p-4 text-center">
              <Users className="text-base-content/30 mx-auto h-6 w-6" />
              <p className="text-base-content/60 mt-2 text-sm">
                Add someone as a friend first, then they can help run your brackets.
              </p>
              <Link
                to={paths.friends}
                className="text-primary mt-2 inline-flex items-center gap-1.5 text-xs font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add a friend
              </Link>
            </div>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
              {people.map((person) => {
                const added = granted.has(person.id)

                return (
                  <li key={person.id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => (added ? onRemove(person.id) : onAdd(person.id))}
                      disabled={pending}
                      // Toggles rather than disabling: clicking a name that
                      // already has access takes it away, so a mis-click is
                      // undone the same way it was made.
                      aria-pressed={added}
                      title={added ? `Remove ${person.name}` : `Give ${person.name} access`}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${
                        added
                          ? 'text-success hover:bg-error/10 hover:text-error'
                          : 'hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {added ? (
                        // Tick at rest, cross on hover — both in one slot so the
                        // row does not reflow as they swap. The tick says "in";
                        // the cross says what the click about to happen does.
                        <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
                          <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
                          <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        </span>
                      ) : (
                        <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      )}
                      <span className="truncate font-medium">{person.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
