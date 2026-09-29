import { useQuery } from '@tanstack/react-query'

import { unwrapList } from '@/api/client'
import {
  friends as friendsApi,
  roster as rosterApi,
  tournaments as tournamentsApi,
} from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

/** Everything the signed-in landing page shows, already counted. */
export function useDashboard() {
  const { data: tournaments, isLoading } = useQuery({
    queryKey: queryKeys.tournaments.all,
    queryFn: () => tournamentsApi.list(),
  })

  const { data: players } = useQuery({
    queryKey: queryKeys.roster.all,
    queryFn: () => rosterApi.list(),
  })

  const { data: pending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: friendsApi.pending,
  })

  const events = unwrapList(tournaments)

  return {
    isLoading,
    recent: events.slice(0, 5),
    counts: {
      tournaments: events.length,
      active: events.filter((t) => t.state === 'active').length,
      players: unwrapList(players).length,
      pendingFriends: unwrapList(pending).length,
    },
  }
}
