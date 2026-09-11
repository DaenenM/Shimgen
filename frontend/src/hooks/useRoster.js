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
    // A real delete, matching what the trash-can control promises: the row is
    // gone, not hidden, and re-adding the name makes a new Player.
    //
    // What survives and what does not, because the two differ: stats rows keep
    // their own `label` and hold the player by SET_NULL, so past results stay
    // on a board. `PlayerRating` is CASCADE, so a deleted player's Elo history
    // goes with them — deleting someone who has played is not reversible by
    // re-adding the same name. `rosterApi.archive` is still there if hiding
    // rather than deleting is wanted somewhere.
    mutationFn: (id) => rosterApi.remove(id),
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
   * Deletes outright in both modes — the localStorage entry signed out, the
   * Player row signed in — so the control does the same thing either way. See
   * `removeOne` for what that does and does not take with it.
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
