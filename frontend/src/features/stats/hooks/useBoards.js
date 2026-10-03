import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { boards as boardsApi } from '@/api/endpoints'
import { editList, optimistic, toggleFavourite } from '@/lib/optimistic'
import { queryKeys } from '@/lib/queryClient'

// Signed-in user's boards, plus create/pin/delete mutations. Used by StatsPage.jsx
// and StatsBoardField.jsx.
export function useBoards({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.boards.all,
    queryFn: boardsApi.list,
    enabled,
    // Always refetch on arrival: other users' actions can change these boards.
    staleTime: 0,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })

  const create = useMutation({
    meta: { errorShown: true },
    mutationFn: (payload) => boardsApi.create(payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    meta: { errorShown: true },
    mutationFn: (slug) => boardsApi.remove(slug),
    ...optimistic(queryClient, queryKeys.boards.all, (data, slug) =>
      editList(data, (list) => list.filter((b) => b.slug !== slug)),
    ),
  })
  const favourite = useMutation({
    mutationFn: (slug) => boardsApi.favourite(slug),
    ...optimistic(queryClient, queryKeys.boards.all, toggleFavourite),
  })

  return { boards: unwrapList(data), isLoading, create, remove, favourite }
}
