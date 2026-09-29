import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

// Active + archived tournaments and their row actions. Used by TournamentsPage.jsx.
// Both queries wait on `enabled` since a signed-out visitor has no account list.
export function useTournamentList({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.tournaments.all, { archived: false }],
    queryFn: () => tournamentsApi.list(),
    enabled,
    // Short staleTime: this is how someone discovers a lobby they were just
    // added to, which their device has no other way to know about.
    staleTime: 10_000,
  })

  // Fetched up front (not on expand) so the disclosure knows its count before being opened.
  const { data: archivedData } = useQuery({
    queryKey: [...queryKeys.tournaments.all, { archived: true }],
    queryFn: () => tournamentsApi.list({ archived: 'true' }),
    enabled,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })

  // Deleting/restaging also changes what linked boards show.
  const invalidateWithBoards = () => {
    invalidate()
    queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
  }

  const favourite = useMutation({
    mutationFn: (id) => tournamentsApi.favourite(id),
    onSuccess: invalidate,
  })
  const archive = useMutation({
    mutationFn: (id) => tournamentsApi.archive(id),
    onSuccess: invalidate,
  })
  const restore = useMutation({
    mutationFn: (id) => tournamentsApi.restore(id),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    meta: { errorShown: true },
    mutationFn: (id) => tournamentsApi.remove(id),
    onSuccess: invalidateWithBoards,
  })
  const runBack = useMutation({
    meta: { errorShown: true },
    // Always reshuffled — running it back means a fresh draw, not the same fixtures again.
    mutationFn: (id) => tournamentsApi.restage(id, { reshuffle: true }),
    onSuccess: invalidateWithBoards,
  })

  return {
    items: unwrapList(data),
    archivedItems: unwrapList(archivedData),
    isLoading,
    favourite,
    archive,
    restore,
    remove,
    runBack,
  }
}
