import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, UserPlus, Users, X } from 'lucide-react'
import { useState } from 'react'

import { friends as friendsApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/PageLoader'
import { queryKeys } from '@/lib/queryClient'

/**
 * Friends.
 *
 * Not a social feature for its own sake: linking accounts is what gives stats
 * continuity across different hosts' events (plan §3), so results follow the
 * person rather than the roster entry they happened to be added under.
 */
export function FriendsPage() {
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')

  const { data: accepted, isLoading } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
  })

  const { data: pending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: friendsApi.pending,
  })

  const { data: sent } = useQuery({
    queryKey: queryKeys.friends.sent,
    queryFn: friendsApi.sent,
  })

  // Prefix-matching, so this covers both lists and the nav's pending count.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.friends.all })

  const request = useMutation({
    mutationFn: () => friendsApi.request(identifier.trim()),
    onSuccess: () => {
      setIdentifier('')
      invalidate()
    },
  })

  const accept = useMutation({ mutationFn: friendsApi.accept, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: friendsApi.remove, onSuccess: invalidate })

  if (isLoading) return <PageLoader label="Loading friends…" />

  const friends = accepted ?? []
  const requests = pending ?? []
  const outgoing = sent ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Friends"
        description="Linking accounts keeps everyone's stats together across whoever is hosting."
      />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (identifier.trim()) request.mutate()
        }}
      >
        <input
          className="input input-bordered flex-1"
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <button type="submit" className="btn btn-primary gap-2" disabled={request.isPending}>
          <UserPlus className="h-4 w-4" />
          Add
        </button>
      </form>

      {request.isError && (
        <div role="alert" className="alert alert-error mb-4 py-2 text-sm">
          {request.error.message}
        </div>
      )}

      {requests.length > 0 && (
        // Above the friends list and visually louder than it: a request is the
        // one thing on this page that is waiting on you.
        <section className="border-primary/40 bg-primary/5 mb-6 rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="text-primary h-4 w-4" />
            {requests.length === 1 ? '1 friend request' : `${requests.length} friend requests`}
          </h2>

          <ul className="grid gap-2">
            {requests.map((item) => (
              <li key={item.id} className="card bg-base-100 border-base-300 border">
                <div className="card-body flex-row items-center justify-between gap-3 p-3">
                  <p className="min-w-0 truncate text-sm font-medium">{item.from_user.name}</p>

                  <div className="flex shrink-0 gap-1">
                    <button
                      className="btn btn-primary btn-sm gap-1"
                      disabled={accept.isPending}
                      onClick={() => accept.mutate(item.id)}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      className="btn btn-ghost btn-sm hover:text-error"
                      onClick={() => remove.mutate(item.id)}
                      aria-label={`Decline request from ${item.from_user.name}`}
                      title="Decline"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base-content/60 mb-2 text-xs font-semibold tracking-wide uppercase">
            Sent, awaiting a reply
          </h2>
          <ul className="grid gap-2">
            {outgoing.map((item) => (
              <li key={item.id} className="card bg-base-100 border-base-300 border">
                <div className="card-body flex-row items-center justify-between gap-3 p-3">
                  <p className="min-w-0 truncate text-sm font-medium">{item.to_user.name}</p>
                  <button
                    className="btn btn-ghost btn-sm hover:text-error"
                    onClick={() => remove.mutate(item.id)}
                    aria-label={`Cancel request to ${item.to_user.name}`}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="text-base-content/60 mb-2 text-xs font-semibold tracking-wide uppercase">
        Friends
      </h2>

      {friends.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No friends yet"
          description="Add someone by username or email. Once they accept, their results follow them across every group you both play in."
        />
      ) : (
        <ul className="grid gap-2">
          {friends.map((item) => {
            // The friendship is stored directionally, so which side is "them"
            // depends on who sent the original request.
            const them = item.direction === 'outgoing' ? item.to_user : item.from_user

            return (
              <li key={item.id} className="card bg-base-100 border-base-300 border">
                <div className="card-body flex-row items-center justify-between gap-3 p-3">
                  <p className="min-w-0 truncate text-sm font-medium">{them.name}</p>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
