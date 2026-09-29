import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { friends as friendsApi } from '@/api/endpoints'
import { Check, Plus, UserPlus, Users, X } from '@/components/icons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useDismiss } from '@/hooks/useDismiss'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * Popover to grant/revoke co-host access to report results (plan §4, NEW 12).
 * Used by TournamentHeader.jsx. Only the creator sees this; co-hosts can't
 * grant access onward.
 */
export function CohostManager({ cohosts, creatorId, onAdd, onRemove, pending }) {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const container = useRef(null)

  // Creator's own role is excluded — removing it would break the tournament.
  const helpers = cohosts.filter((role) => role.role === 'cohost' && role.user)
  const granted = new Set(helpers.map((role) => role.user.id))

  // Fetch only once the popover opens, not on every bracket page load.
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
    enabled: open && isAuthenticated,
  })

  // Friendship is stored directionally; which side is "them" depends on who sent the request.
  const friends = (data ?? [])
    .map((item) => (item.direction === 'outgoing' ? item.to_user : item.from_user))
    .filter((person) => person && person.id !== creatorId)

  // Keep anyone still holding the permission even if the friendship has since ended.
  const orphaned = helpers
    .map((role) => role.user)
    .filter((person) => !friends.some((friend) => friend.id === person.id))

  const people = [...friends, ...orphaned].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  )

  // Click-away and Escape close the popover, matching every other one on the page.
  useDismiss(container, open, () => setOpen(false))

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
            // Distinct from "everyone is already added" — this person has no friends yet.
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
                      // Toggles: clicking an already-added name removes access.
                      aria-pressed={added}
                      title={added ? `Remove ${person.name}` : `Give ${person.name} access`}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${
                        added
                          ? 'text-success hover:bg-error/10 hover:text-error'
                          : 'hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {added ? (
                        // Tick at rest, cross on hover, same slot to avoid reflow.
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
