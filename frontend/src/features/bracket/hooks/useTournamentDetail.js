import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

import { eliminatedIds, standingsFor } from '../utils/standings'

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

  // Derived from cached matches, so it moves the instant a result is clicked.
  const standings = useMemo(() => standingsFor(tournament), [tournament])
  const eliminated = useMemo(() => eliminatedIds(tournament), [tournament])

  // A bare-id URL rewrites to the named form; `replace` keeps it out of the back stack.
  const canonical = tournament ? paths.tournament(tournament.id, tournament.title) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  // Also invalidates the tournament list and boards — used where tournament state
  // changes (start, rename), since those caches would otherwise serve stale data.
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
  }

  // Patches the cached tournament on click and restores it if the request fails.
  const patchDetail = (patch) => ({
    onMutate: (vars) => {
      const previous = queryClient.getQueryData(key)
      if (previous) queryClient.setQueryData(key, patch(previous, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
  })

  const start = useMutation({
    meta: { errorShown: true },
    mutationFn: () => tournamentsApi.start(id),
    ...patchDetail((t) => ({ ...t, state: 'active' })),
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
    ...patchDetail((t, title) => ({ ...t, title })),
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
    ...patchDetail((t, userId) => ({
      ...t,
      roles: (t.roles ?? []).filter((r) => r.role === 'host' || r.user?.id !== userId),
    })),
    onSuccess: refresh,
  })

  // One line under the header for whichever host action last failed (board picker shows its own).
  const actionError = [start, nextRound, rename, addCohost, removeCohost].find(
    (m) => m.isError,
  )?.error

  return {
    tournament,
    standings,
    eliminated,
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
