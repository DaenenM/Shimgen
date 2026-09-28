import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * A tournament, its standings, and the host's actions on it.
 *
 * Reporting results is separate — see `useBracketReporting` — because it runs
 * through a batching queue rather than one mutation per click.
 */
export function useTournamentDetail(id) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const key = queryKeys.tournaments.detail(id)

  const { data: tournament, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => tournamentsApi.get(id),
  })

  const { data: standings } = useQuery({
    queryKey: queryKeys.tournaments.standings(id),
    queryFn: () => tournamentsApi.standings(id),
    enabled: Boolean(tournament),
  })

  // Arriving by the bare id — an old link, or one typed by hand — rewrites the
  // address bar to the named form, so copying from the browser gives the same
  // shape the share link does. `replace` keeps it out of the back stack.
  const canonical = tournament ? paths.tournament(tournament.id, tournament.title) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  // Both the bracket and the standings derive from the same match rows, so any
  // change invalidates both — standings are computed, never stored. One
  // invalidation covers them: React Query matches keys by prefix, and
  // ['tournaments', id] is a prefix of ['tournaments', id, 'standings'].
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  /**
   * Refresh the detail *and* the lists behind it.
   *
   * Used where the tournament's state changes — starting it, renaming it —
   * because the list shows that state and would otherwise keep serving a cached
   * copy for the next two minutes. A linked board moves with the tournament's
   * state too, so its cache cannot be left claiming to be fresh.
   */
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
  }

  const start = useMutation({
    meta: { errorShown: true },
    mutationFn: () => tournamentsApi.start(id),
    onSuccess: refreshAll,
  })

  const nextRound = useMutation({
    meta: { errorShown: true },
    mutationFn: () => tournamentsApi.nextRound(id),
    onSuccess: refresh,
  })

  /**
   * Rename the tournament.
   *
   * Written to the cache first so the header changes on Enter. The list behind
   * it shows the same title, and the URL carries it as a readable tail, so both
   * are refreshed once the server confirms.
   */
  const rename = useMutation({
    meta: { errorShown: true },
    mutationFn: (title) => tournamentsApi.update(id, { title }),
    onMutate: (title) => {
      const previous = queryClient.getQueryData(key)
      if (previous) queryClient.setQueryData(key, { ...previous, title })
      return { previous }
    },
    onError: (_error, _title, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: refreshAll,
  })

  /**
   * Move this tournament to another stats board, or take it off one.
   *
   * The response is the whole tournament, so it replaces the cache outright —
   * linking enrols players and recounts what has been played, and none of that
   * is worth trying to predict locally.
   */
  const linkBoard = useMutation({
    meta: { errorShown: true },
    // A table id when the host picked one table of several, so the night lands
    // where they pointed it rather than wherever the server would have guessed.
    mutationFn: ({ slug, tableId }) => tournamentsApi.linkStatsBoard(id, slug, tableId),
    onSuccess: (fresh) => {
      queryClient.setQueryData(key, fresh)
      // The board itself now holds different numbers, and the stats list shows
      // them. `['boards']` is a prefix of every board's key, so this covers the
      // one just linked and the one just left.
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
    },
  })

  const addCohost = useMutation({
    meta: { errorShown: true },
    mutationFn: (userId) => tournamentsApi.addCohost(id, userId),
    onSuccess: refresh,
  })

  const removeCohost = useMutation({
    meta: { errorShown: true },
    mutationFn: (userId) => tournamentsApi.removeCohost(id, userId),
    onSuccess: refresh,
  })

  // One line under the header for whichever host action last failed. The
  // board picker shows its own error in its own menu, so it is not here.
  const actionError = [start, nextRound, rename, addCohost, removeCohost].find(
    (m) => m.isError,
  )?.error

  return {
    tournament,
    standings,
    isLoading,
    start,
    nextRound,
    rename,
    linkBoard,
    addCohost,
    removeCohost,
    actionError,
  }
}
