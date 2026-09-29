import { Check, UserPlus, X } from '@/components/icons'
import { Button } from '@/components/ui/Button'

import { PersonRow } from './PersonRow'

/**
 * Requests waiting on you. Above the friends list and visually louder than it:
 * this is the one thing on the page that needs an answer.
 */
export function IncomingRequests({ requests, accept, remove }) {
  if (requests.length === 0) return null

  return (
    <section className="border-primary/40 bg-primary/5 mb-6 rounded-xl border p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="text-primary h-4 w-4" />
        {requests.length === 1 ? '1 friend request' : `${requests.length} friend requests`}
      </h2>

      <ul className="grid gap-2">
        {requests.map((item) => (
          <PersonRow key={item.id} person={item.from_user}>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                icon={Check}
                disabled={accept.isPending}
                onClick={() => accept.mutate(item.id)}
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hover:text-error"
                onClick={() => remove.mutate(item.id)}
                aria-label={`Decline request from ${item.from_user.name}`}
                title="Decline"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </PersonRow>
        ))}
      </ul>
    </section>
  )
}
