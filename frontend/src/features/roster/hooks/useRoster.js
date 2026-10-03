// Saved roster, signed out (localStorage) or signed in (server), behind one interface.
// Used by RosterPicker.jsx, SavedRoster.jsx, TeamBuilder.jsx, and roster/team/board pages.
// Stored shape mirrors the server's Player model (plan §5) so no branching is needed by callers.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { roster as rosterApi } from '@/api/endpoints'
import { optimistic, patchById, removeById } from '@/lib/optimistic'
import { queryKeys } from '@/lib/queryClient'

import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLocalRoster } from './useLocalRoster'
import { unwrapList } from '@/api/client'

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
    // Real delete: stats rows survive (SET_NULL), but PlayerRating is CASCADE,
    // so a deleted player's Elo history is gone even if the same name is re-added.
    mutationFn: (id) => rosterApi.remove(id),
    ...optimistic(queryClient, queryKeys.roster.all, removeById),
  })

  const archiveOne = useMutation({
    mutationFn: (id) => rosterApi.archive(id),
    ...optimistic(queryClient, queryKeys.roster.all, (data, id) =>
      patchById(data, id, { archived: true }),
    ),
  })

  const players = useMemo(() => {
    if (!isAuthenticated) return local.players
    // Archived rows only appear here mid-optimistic-update; the server list excludes them.
    return unwrapList(data).filter((p) => !p.archived)
  }, [isAuthenticated, local.players, data])

  // Remembers names just used. Signed in, the bulk endpoint de-dupes server-side.
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

  // Drops someone from the saved roster — deletes outright in both modes.
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

  // Hides a friend/self row without losing rating history (delete is refused server-side for these).
  const archive = useCallback(
    (player) => {
      if (isAuthenticated && player.id) archiveOne.mutate(player.id)
    },
    [isAuthenticated, archiveOne],
  )

  return {
    players,
    isLoading: isAuthenticated && isLoading,
    remember,
    forget,
    archive,
    touchLocal: local.touch,
  }
}
