import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

const activeKey = [...queryKeys.tournaments.all, { archived: false }]
const archivedKey = [...queryKeys.tournaments.all, { archived: true }]

// Active + archived tournaments and their row actions. Used by TournamentsPage.jsx.
// Both queries wait on `enabled` since a signed-out visitor has no account list.
export function useTournamentList({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  const { data, isLoading, isSuccess } = useQuery({
    queryKey: activeKey,
    queryFn: () => tournamentsApi.list(),
    enabled,
    // Short staleTime: this is how someone discovers a lobby they were just
    // added to, which their device has no other way to know about.
    staleTime: 10_000,
  })

  // Fetched up front (not on expand) so the disclosure knows its count before being opened.
  const { data: archivedData, isSuccess: archivedSuccess } = useQuery({
    queryKey: archivedKey,
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
  // Optimistic update shared by archive/restore/delete: `apply(id)` edits the
  // cached lists on click; a failed request restores the snapshot taken first.
  const optimistic = (apply, onSettled) => ({
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tournaments.all })
      const snapshot = queryClient.getQueriesData({ queryKey: queryKeys.tournaments.all })
      apply(id)
      return { snapshot }
    },
    onError: (_error, _id, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled,
  })

  // Moves a tournament out of every cached list and onto the front of `target`.
  const moveTo = (target) => (id) => {
    const item = findTournament(queryClient, id)
    queryClient.setQueriesData({ queryKey: queryKeys.tournaments.all }, (data) =>
      withoutTournament(data, id),
    )
    if (item) {
      queryClient.setQueryData(target, (data) => withTournamentFirst(data, item))
    }
  }

  const archive = useMutation({
    mutationFn: (id) => tournamentsApi.archive(id),
    ...optimistic(moveTo(archivedKey), invalidate),
  })
  const restore = useMutation({
    mutationFn: (id) => tournamentsApi.restore(id),
    ...optimistic(moveTo(activeKey), invalidate),
  })
  const remove = useMutation({
    meta: { errorShown: true },
    mutationFn: (id) => tournamentsApi.remove(id),
    ...optimistic(
      (id) =>
        queryClient.setQueriesData({ queryKey: queryKeys.tournaments.all }, (data) =>
          withoutTournament(data, id),
        ),
      invalidateWithBoards,
    ),
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
    // Both lists have answered at least once — used to decide "no tournaments at all".
    isSettled: isSuccess && archivedSuccess,
    favourite,
    archive,
    restore,
    remove,
    runBack,
  }
}

// Removes a tournament from a cached list, whether paginated ({ results }) or a
// bare array. Anything else under the tournaments key (a detail) is left alone.
function withoutTournament(data, id) {
  if (Array.isArray(data)) return data.filter((t) => t.id !== id)
  if (Array.isArray(data?.results)) {
    return { ...data, results: data.results.filter((t) => t.id !== id) }
  }
  return data
}

// Adds a tournament to the front of a cached list (array or { results }).
// An uncached list is left for the refetch to fill.
function withTournamentFirst(data, item) {
  if (Array.isArray(data)) return [item, ...data]
  if (Array.isArray(data?.results)) return { ...data, results: [item, ...data.results] }
  return data
}

// The tournament's row from any cached list, so it can be moved between lists.
function findTournament(queryClient, id) {
  for (const [, data] of queryClient.getQueriesData({ queryKey: queryKeys.tournaments.all })) {
    const list = Array.isArray(data) ? data : data?.results
    const found = Array.isArray(list) && list.find((t) => t.id === id)
    if (found) return found
  }
  return null
}
