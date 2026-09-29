import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { boards as boardsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

/** The signed-in user's boards, and creating, pinning and deleting them. */
export function useBoards({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.boards.all,
    queryFn: boardsApi.list,
    enabled,
    // Boards move without this tab doing anything: a co-host reports a result
    // from their own phone and the tally changes. The bracket page invalidates
    // this cache after its own reports, but it cannot know about anyone else's,
    // so arriving here always asks. `placeholderData` keeps the cached board on
    // screen while it does, so this costs a background request rather than a
    // spinner.
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
