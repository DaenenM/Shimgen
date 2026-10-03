import { useQuery } from '@tanstack/react-query'

import { games as gamesApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

import { suggestGames } from '../utils/games'

// Preset games, fetched once per session, filtered against what's typed. Used by GameField.jsx.
export function useGameSuggestions(text) {
  const { data = [] } = useQuery({
    queryKey: queryKeys.games.all,
    queryFn: gamesApi.list,
    staleTime: Infinity,
  })

  return suggestGames(data, text)
}
