import { useQuery, useQueryClient } from '@tanstack/react-query'

import { spectate } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { useTournamentSocket } from './useTournamentSocket'

// Public bracket + standings, kept live over a socket rather than polling.
// Used by SpectatorPage.jsx.
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

  // Socket groups are per tournament id (from the payload), not the URL slug.
  useTournamentSocket(
    tournament?.id,
    () => queryClient.invalidateQueries({ queryKey: queryKeys.spectate.detail(publicSlug) }),
    { enabled: Boolean(tournament?.id) },
  )

  return { tournament, standings, isLoading }
}
