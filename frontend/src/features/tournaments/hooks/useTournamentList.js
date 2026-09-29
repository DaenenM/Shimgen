import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

/**
 * The tournaments list: active and archived, and every row action.
 *
 * Nothing to list for a signed-out visitor — their brackets live in the links
 * they hold, not in an account — so both queries wait on `enabled`.
 */
export function useTournamentList({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.tournaments.all, { archived: false }],
    queryFn: () => tournamentsApi.list(),
    enabled,
    // Ten seconds rather than the global two minutes. This list is how somebody
    // finds a lobby they have just been added to, and nothing on their device
    // knows it happened — the invalidation after creating a tournament runs in
    // the *host's* browser, not in theirs. Two minutes of "fresh" meant a
    // friend opened this page and saw nothing, with no way to tell whether they
    // had been added or not.
    staleTime: 10_000,
  })

  // Fetched up front rather than on expand: the section only appears when it
  // has something in it, so the page has to know the count before anyone can
  // ask for it. A second short list is cheap next to hiding an empty control.
  const { data: archivedData } = useQuery({
    queryKey: [...queryKeys.tournaments.all, { archived: true }],
    queryFn: () => tournamentsApi.list({ archived: 'true' }),
    enabled,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })

  // Deleting or restaging changes what linked boards show, so the boards this
  // tab holds are out of date after either.
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
    // Always reshuffled. Running it back means playing it again, not replaying
    // the same fixtures — and a rematch of the identical first round is the one
    // thing nobody asks for twice.
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
