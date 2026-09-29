import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { boards as boardsApi } from '@/api/endpoints'
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
    onSuccess: invalidate,
  })
  const favourite = useMutation({
    mutationFn: (slug) => boardsApi.favourite(slug),
    onSuccess: invalidate,
  })

  return { boards: unwrapList(data), isLoading, create, remove, favourite }
}
