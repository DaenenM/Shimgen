import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { roster as rosterApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

/**
 * The roster page's data: every saved player, archived ones included, and the
 * actions that change them.
 *
 * Separate from `hooks/useRoster`, which serves the pickers and has to work
 * signed out. This page is signed-in only and needs the archive as well.
 */
export function useRosterManager() {
  const queryClient = useQueryClient()

  // Archived players are always fetched and filtered here rather than by the
  // server. Asking only when the toggle was on meant the count was always zero
  // while it was off — so the control that reveals them never appeared, and an
  // archived name had no way back.
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

  const players = data?.results ?? data ?? []

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
