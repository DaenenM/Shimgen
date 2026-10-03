import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { friends as friendsApi } from '@/api/endpoints'
import { editList, optimistic, removeById, sameKey } from '@/lib/optimistic'
import { queryKeys } from '@/lib/queryClient'

/** Accepted friends, requests both ways, and the actions on them. */
export function useFriends() {
  const queryClient = useQueryClient()

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

  // Prefix-matching, so this covers every list and the nav's pending count.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.friends.all })

  const request = useMutation({
    meta: { errorShown: true },
    mutationFn: (handle) => friendsApi.request(handle.trim()),
    onSuccess: invalidate,
  })
  // Accepting moves the request into friends on click.
  const accept = useMutation({
    mutationFn: friendsApi.accept,
    ...optimistic(
      queryClient,
      queryKeys.friends.all,
      (data, id, key, request) =>
        sameKey(key, queryKeys.friends.accepted) && request
          ? editList(data, (list) => [{ ...request, status: 'accepted' }, ...list])
          : removeById(data, id),
      {
        prepare: (id) =>
          unwrapList(queryClient.getQueryData(queryKeys.friends.pending)).find((r) => r.id === id),
      },
    ),
  })
  const remove = useMutation({
    mutationFn: friendsApi.remove,
    ...optimistic(queryClient, queryKeys.friends.all, removeById),
  })

  const friends = accepted ?? []
  const incoming = pending ?? []
  const outgoing = sent ?? []

  // Everyone already connected either way, so search can leave them out:
  // offering them would produce a guaranteed 400 — already friends, request
  // already pending — which is a worse answer than not offering them at all.
  const connectedIds = new Set(
    [...friends, ...incoming, ...outgoing].flatMap((item) =>
      [item.from_user?.id, item.to_user?.id].filter(Boolean),
    ),
  )

  return { isLoading, friends, incoming, outgoing, connectedIds, request, accept, remove }
}
