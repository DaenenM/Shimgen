import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { unwrapList } from '@/api/client'
import { savedTeams as savedTeamsApi } from '@/api/endpoints'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { optimistic, patchById, removeById } from '@/lib/optimistic'
import { queryKeys } from '@/lib/queryClient'

// Saved teams CRUD. Used by SavedTeamsPage.jsx and SavedTeamPicker.jsx.
// No logged-out mode (unlike useRoster) — a saved team belongs to an account, so signed out the list is empty.
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

  // Errors shown inline in SavedTeamsPage's own forms.
  const create = useMutation({
    meta: { errorShown: true },
    mutationFn: (payload) => savedTeamsApi.create(payload),
    onSuccess: invalidate,
  })

  const update = useMutation({
    meta: { errorShown: true },
    mutationFn: ({ id, ...payload }) => savedTeamsApi.update(id, payload),
    // Name and logo show at once; member changes arrive with the refetch.
    ...optimistic(queryClient, queryKeys.savedTeams.all, (data, { id, name, logo }) =>
      patchById(data, id, {
        ...(name !== undefined ? { name } : {}),
        ...(logo !== undefined ? { logo } : {}),
      }),
    ),
  })

  const remove = useMutation({
    mutationFn: (id) => savedTeamsApi.remove(id),
    ...optimistic(queryClient, queryKeys.savedTeams.all, removeById),
  })

  // unwrapList reads both paginated and unpaginated shapes, since this endpoint may change.
  const teams = unwrapList(data)

  return { teams, isLoading, create, update, remove }
}
