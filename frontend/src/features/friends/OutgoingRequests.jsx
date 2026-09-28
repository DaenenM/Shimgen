import { Button } from '@/components/ui/Button'

import { PersonRow } from './PersonRow'

/** Requests you sent that nobody has answered yet. */
export function OutgoingRequests({ requests, remove }) {
  if (requests.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="text-base-content/60 mb-2 text-xs font-semibold tracking-wide uppercase">
        Sent, awaiting a reply
      </h2>
      <ul className="grid gap-2">
        {requests.map((item) => (
          <PersonRow key={item.id} person={item.to_user}>
            <Button
              variant="ghost"
              size="sm"
              className="hover:text-error"
              onClick={() => remove.mutate(item.id)}
              aria-label={`Cancel request to ${item.to_user.name}`}
            >
              Cancel
            </Button>
          </PersonRow>
        ))}
      </ul>
    </section>
  )
}
