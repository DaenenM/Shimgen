import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { roster as rosterApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

// Roster page data: every saved player (including archived) and actions on them.
// Used by RosterPage.jsx. Signed-in only, unlike useRoster which also serves signed-out pickers.
export function useRosterManager() {
  const queryClient = useQueryClient()

  // Always fetch archived players (filtered client-side) so the reveal toggle's
  // count isn't stuck at zero while collapsed.
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.roster.all, 'all'],
    queryFn: () => rosterApi.list({ include_archived: 'true' }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.roster.all })

  const add = useMutation({
    meta: { errorShown: true },
    mutationFn: (names) => rosterApi.bulk(names),
    onSuccess: invalidate,
  })
  const archive = useMutation({
    mutationFn: (id) => rosterApi.archive(id),
    onSuccess: invalidate,
  })
  const restore = useMutation({
    mutationFn: (id) => rosterApi.restore(id),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id) => rosterApi.remove(id),
    onSuccess: invalidate,
  })

  const players = unwrapList(data)

  return {
    isLoading,
    active: players.filter((p) => !p.archived),
    archived: players.filter((p) => p.archived),
    add,
    archive,
    restore,
    remove,
  }
}
