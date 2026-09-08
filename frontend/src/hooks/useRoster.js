/**
 * The saved roster, wherever it happens to live.
 *
 * Signed out it is localStorage; signed in it is the server. Both are exposed
 * through one interface so no component has to branch on auth state — which is
 * what keeps the roster picker identical in both modes, and is the whole reason
 * the stored shape mirrors the server's Player model (plan §5).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { roster as rosterApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { useAuth } from './useAuth'
import { useLocalRoster } from './useLocalRoster'

export function useRoster() {
  const { isAuthenticated } = useAuth()
  const local = useLocalRoster()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.roster.all,
    queryFn: () => rosterApi.list(),
    enabled: isAuthenticated,
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.roster.all }),
    [queryClient],
  )

  const createMany = useMutation({
    mutationFn: (names) => rosterApi.bulk(names),
    onSuccess: invalidate,
  })

  const removeOne = useMutation({
    // Archive rather than delete: a saved player may already appear in past
    // tournaments, and removing the row would orphan those results. Archiving
    // takes them out of the picker while keeping the history intact.
    mutationFn: (id) => rosterApi.archive(id),
    onSuccess: invalidate,
  })

  const players = useMemo(() => {
    if (!isAuthenticated) return local.players
    return data?.results ?? data ?? []
  }, [isAuthenticated, local.players, data])

  /**
   * Remember names that were just used.
   *
   * Signed out this writes to localStorage. Signed in it posts to the bulk
   * endpoint, which de-duplicates server-side — so calling it with names
   * already on the roster is harmless and does not need a check here.
   */
  const remember = useCallback(
    (names) => {
      const cleaned = names.map((n) => n.trim()).filter(Boolean)
      if (cleaned.length === 0) return

      if (isAuthenticated) {
        createMany.mutate(cleaned)
      } else {
        local.addMany(cleaned)
      }
    },
    [isAuthenticated, local, createMany],
  )

  /**
   * Drop someone from the saved roster.
   *
   * Signed out that deletes the localStorage entry outright. Signed in it
   * archives the Player, since their name may already be attached to finished
   * tournaments and deleting the row would orphan those results.
   */
  const forget = useCallback(
    (player) => {
      if (isAuthenticated) {
        if (player.id) removeOne.mutate(player.id)
      } else {
        local.remove(player.display_name)
      }
    },
    [isAuthenticated, local, removeOne],
  )

  return {
    players,
    isLoading: isAuthenticated && isLoading,
    remember,
    forget,
    touchLocal: local.touch,
  }
}
