import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { unwrapList } from '@/api/client'
import { savedTeams as savedTeamsApi } from '@/api/endpoints'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'

/**
 * Squads kept between game nights.
 *
 * Unlike `useRoster` there is no logged-out half: a saved team is built out of
 * roster entries that belong to an account, so there is nothing coherent to
 * store for a visitor who has none. Signed out the list is simply empty, and
 * the pages that offer it are behind the auth guard anyway.
 */
export function useSavedTeams() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.savedTeams.all,
    queryFn: () => savedTeamsApi.list(),
    enabled: isAuthenticated,
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.savedTeams.all }),
    [queryClient],
  )

  // SavedTeamsPage shows create and update errors inside their own forms.
  const create = useMutation({
    meta: { errorShown: true },
    mutationFn: (payload) => savedTeamsApi.create(payload),
    onSuccess: invalidate,
  })

  const update = useMutation({
    meta: { errorShown: true },
    mutationFn: ({ id, ...payload }) => savedTeamsApi.update(id, payload),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id) => savedTeamsApi.remove(id),
    onSuccess: invalidate,
  })

  // The list endpoint is unpaginated for a personal collection, but DRF can be
  // configured to paginate later — reading both shapes costs nothing now and
  // saves a confusing empty list if it ever is.
  const teams = unwrapList(data)

  return { teams, isLoading, create, update, remove }
}
