import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

// A tournament, its standings, and the host's actions on it (start, rename, link board, cohosts).
// Used by TournamentHeader.jsx and TournamentDetailPage.jsx.
// Reporting results is separate (see useBracketReporting) since it batches via a queue.
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

  // A bare-id URL rewrites to the named form; `replace` keeps it out of the back stack.
  const canonical = tournament ? paths.tournament(tournament.id, tournament.title) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  // Standings are computed from matches, never stored, so invalidating the detail
  // key also covers standings (React Query matches by prefix).
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  // Also invalidates the tournament list and boards — used where tournament state
  // changes (start, rename), since those caches would otherwise serve stale data.
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

  // Written to the cache first so the header updates on Enter, before the server confirms.
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

  // Move this tournament to another stats board, or off one. Response is the whole
  // tournament (linking enrols players and recounts), so it replaces the cache outright.
  const linkBoard = useMutation({
    meta: { errorShown: true },
    // tableId lets the host pick one table of several rather than the server guessing.
    mutationFn: ({ slug, tableId }) => tournamentsApi.linkStatsBoard(id, slug, tableId),
    onSuccess: (fresh) => {
      queryClient.setQueryData(key, fresh)
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

  // One line under the header for whichever host action last failed (board picker shows its own).
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
