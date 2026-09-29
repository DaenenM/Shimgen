import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

import { applyPick, applyUndo } from '../utils/transitions'
import { useDraftSocket } from './useDraftSocket'

/**
 * Everything the draft lobby reads and does: the tournament, the live draft,
 * picking, undoing, finishing, and the hand-over to the bracket.
 */
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
    // The pool moves on every pick and a stale lobby shows a player who has
    // already been taken — the one thing that would make two captains pick the
    // same person.
    staleTime: 0,
    // No polling: the socket below pushes every change. This query exists to
    // paint the page before the socket has connected, and as the fallback if it
    // never does.
  })

  // Everyone watching converges on one server-rendered payload. The socket is
  // read-only — picks still go through the REST endpoint, which owns the turn
  // check — so this only ever writes what the server has already decided.
  useDraftSocket(id, (next) => queryClient.setQueryData(key, next))

  /**
   * Picks and undos land the instant they are tapped.
   *
   * A draft is a room of people watching one screen, and a name that sits still
   * for a round trip before moving reads as a missed tap — so the next person
   * taps again. The cache is written synchronously and the request follows; the
   * server's own response replaces it when it arrives.
   */
  function optimistic(transition) {
    return {
      onMutate: (variables) => {
        const previous = queryClient.getQueryData(key)
        if (previous) queryClient.setQueryData(key, transition(previous, variables))

        // Not awaited: React Query holds the mutation until onMutate resolves,
        // so awaiting the abort would put the round trip back in front of the
        // tap — the exact delay this exists to remove.
        queryClient.cancelQueries({ queryKey: key })

        return { previous }
      },
      // The server is the authority on what actually happened — a name someone
      // else took first comes back corrected here.
      onSuccess: (next) => queryClient.setQueryData(key, next),
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
      // The bracket now exists, so both the list and this tournament's own
      // cached copy are out of date.
      queryClient.setQueryData(queryKeys.tournaments.detail(id), finished)
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
      navigate(paths.tournament(finished.id, finished.title))
    },
  })

  /**
   * A finished draft is not a page, it is a redirect.
   *
   * Everyone watching the lobby is told the moment the last pick lands — the
   * socket carries `completed_at` — and the only useful thing to show them is
   * the bracket the draft just produced. An interstitial saying "this draft is
   * finished, click here" made every spectator take a manual step to see the
   * thing they were waiting for.
   *
   * `replace` so the back button leaves the tournament rather than bouncing
   * through a lobby that no longer exists.
   */
  useEffect(() => {
    if (!draft?.completed_at) return

    // Refetch the bracket before handing over to it. Everyone watching the
    // lobby already holds a cached copy of this tournament from *during* the
    // draft — when it genuinely had no entrants and no matches — and with a
    // two-minute staleTime plus `placeholderData`, the bracket page would paint
    // that empty copy and sit there saying "No bracket yet" over a bracket that
    // exists.
    //
    // The host never saw it: `draft_complete`'s own onSuccess writes the fresh
    // tournament into their cache. This is everyone else.
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
