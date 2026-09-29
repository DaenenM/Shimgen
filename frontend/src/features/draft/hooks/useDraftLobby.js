import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

import { applyPick, applyUndo } from '../utils/transitions'
import { useDraftSocket } from './useDraftSocket'

// Draft lobby data and actions: tournament, live draft, pick/undo/complete, handoff to bracket.
// Used by DraftLobbyPage.jsx.
export function useDraftLobby(id) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const key = queryKeys.tournaments.draft(id)

  const { data: tournament, isLoading } = useQuery({
    queryKey: queryKeys.tournaments.detail(id),
    queryFn: () => tournamentsApi.get(id),
  })

  const { data: draft } = useQuery({
    queryKey: key,
    queryFn: () => tournamentsApi.draft(id),
    staleTime: 0, // stale pool risks two captains picking the same person
    // No polling — the socket below pushes updates; this is just the initial paint / fallback.
  })

  // Socket is read-only; picks go through the REST endpoint, which owns the turn check.
  useDraftSocket(id, (next) => queryClient.setQueryData(key, next))

  // Applies picks/undos to the cache immediately so the UI doesn't lag behind taps.
  function optimistic(transition) {
    return {
      onMutate: (variables) => {
        const previous = queryClient.getQueryData(key)
        if (previous) queryClient.setQueryData(key, transition(previous, variables))

        // Not awaited — awaiting here would reintroduce the round-trip delay this avoids.
        queryClient.cancelQueries({ queryKey: key })

        return { previous }
      },
      onSuccess: (next) => queryClient.setQueryData(key, next), // server corrects any race (e.g. name taken)
      onError: (_error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous)
      },
    }
  }

  const pick = useMutation({
    meta: { errorShown: true },
    mutationFn: (label) => tournamentsApi.draftPick(id, label),
    ...optimistic(applyPick),
  })

  const undo = useMutation({
    meta: { errorShown: true },
    mutationFn: () => tournamentsApi.draftUndo(id),
    ...optimistic(applyUndo),
  })

  const complete = useMutation({
    meta: { errorShown: true },
    mutationFn: () => tournamentsApi.draftComplete(id),
    onSuccess: (finished) => {
      // Bracket now exists; refresh both the list and this tournament's cache.
      queryClient.setQueryData(queryKeys.tournaments.detail(id), finished)
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
      navigate(paths.tournament(finished.id, finished.title))
    },
  })

  // A finished draft redirects everyone straight to the bracket (socket carries `completed_at`).
  // `replace` so back-navigation skips the now-gone lobby.
  useEffect(() => {
    if (!draft?.completed_at) return

    // Invalidate the stale "no bracket yet" tournament cache from during the draft.
    // The host already gets a fresh copy via draft_complete's onSuccess; this covers everyone else.
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.standings(id) })

    navigate(paths.tournament(id, tournament?.title), { replace: true })
  }, [draft?.completed_at, id, tournament?.title, navigate, queryClient])

  return {
    tournament,
    draft,
    isLoading: isLoading || !draft,
    pick,
    undo,
    complete,
    error: pick.error ?? undo.error ?? complete.error,
  }
}
