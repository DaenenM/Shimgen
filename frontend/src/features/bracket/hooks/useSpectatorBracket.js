import { useQuery, useQueryClient } from '@tanstack/react-query'

import { spectate } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { useTournamentSocket } from './useTournamentSocket'

/**
 * A public bracket and its standings, kept live.
 *
 * Live over a socket rather than polling. The spectator page is the one most
 * likely to be left open on a second screen while somebody else reports
 * results, so a score that lags half a minute behind the room is exactly the
 * wrong failure — and it is the page with the most viewers, so a request every
 * thirty seconds per viewer was the most wasteful place to poll.
 */
export function useSpectatorBracket(publicSlug) {
  const queryClient = useQueryClient()

  const { data: tournament, isLoading } = useQuery({
    queryKey: queryKeys.spectate.detail(publicSlug),
    queryFn: () => spectate.get(publicSlug),
  })

  const { data: standings } = useQuery({
    queryKey: queryKeys.spectate.standings(publicSlug),
    queryFn: () => spectate.standings(publicSlug),
    enabled: Boolean(tournament),
  })

  // Keyed by id rather than the slug the URL carries: the socket groups are per
  // tournament id, and the spectator payload includes it. `enabled` keeps the
  // hook from opening a connection before the first fetch answers. The detail
  // key is a prefix of the standings key, so one invalidation refreshes both.
  useTournamentSocket(
    tournament?.id,
    () => queryClient.invalidateQueries({ queryKey: queryKeys.spectate.detail(publicSlug) }),
    { enabled: Boolean(tournament?.id) },
  )

  return { tournament, standings, isLoading }
}
