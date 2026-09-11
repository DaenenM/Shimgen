import { useQuery } from '@tanstack/react-query'
import { Check, UserPlus, Users } from '@/components/icons'
import { Link } from 'react-router-dom'

import { friends as friendsApi } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * Pick people to hand permission to, from the ones you already trust.
 *
 * Both places this is used — sharing a stats board, adding a co-host — grant
 * real power over a shared record, so both are limited to accepted friends.
 * Typing an email would let you address anyone at all; a friendship is mutual,
 * which is what makes it a reasonable gate.
 *
 * `selected` is a list of account ids, so the caller keeps whatever shape its
 * own state wants.
 */
export function FriendPicker({ selected = [], onToggle, exclude = [], emptyHint, allHint }) {
  const { isAuthenticated } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
    enabled: isAuthenticated,
  })

  const chosen = new Set(selected)
  const hidden = new Set(exclude)

  // A friendship is stored directionally, so which side is "them" depends on
  // who sent the original request.
  const people = (data ?? [])
    .map((item) => (item.direction === 'outgoing' ? item.to_user : item.from_user))
    .filter((person) => person && !hidden.has(person.id))

  if (isLoading) {
    return <span className="loading loading-spinner loading-sm" />
  }

  if (people.length === 0) {
    // Two different empty states. Having no friends at all is worth a prompt to
    // go and add one; having already added every friend you have is just done,
    // and telling that person to "add a friend first" reads as a bug.
    const everyoneAdded = (data ?? []).length > 0

    return (
      <div className="border-base-300 bg-base-200/30 rounded-xl border border-dashed p-4 text-center">
        <Users className="text-base-content/30 mx-auto h-6 w-6" />
        <p className="text-base-content/60 mt-2 text-sm">
          {everyoneAdded
            ? (allHint ?? 'Everyone on your friends list already has access.')
            : (emptyHint ?? 'Only your friends can be given access.')}
        </p>

        {!everyoneAdded && (
          <Link to={paths.friends} className="btn btn-ghost btn-xs mt-2 gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Add a friend
          </Link>
        )}
      </div>
    )
  }

  return (
    <ul className="border-base-300 bg-base-200/30 max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
      {people.map((person) => {
        const picked = chosen.has(person.id)

        return (
          <li key={person.id}>
            <button
              type="button"
              onClick={() => onToggle(person)}
              aria-pressed={picked}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${
                picked ? 'bg-primary/15 text-primary' : 'hover:bg-base-content/5'
              }`}
            >
              {/* A tick that is always laid out, so the row does not shift
                  sideways the moment it is chosen. */}
              <span className="grid h-4 w-4 shrink-0 place-items-center">
                {picked && <Check className="h-4 w-4" />}
              </span>

              <span className="min-w-0 truncate text-sm font-medium">{person.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
