import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { savedTeams as savedTeamsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { useAuth } from './useAuth'

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

  const create = useMutation({
    mutationFn: (payload) => savedTeamsApi.create(payload),
    onSuccess: invalidate,
  })

  const update = useMutation({
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
  const teams = data?.results ?? data ?? []

  return { teams, isLoading, create, update, remove }
}
