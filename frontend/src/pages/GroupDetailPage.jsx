import { useQuery } from '@tanstack/react-query'
import { BarChart3, Gamepad2, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { groups as groupsApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/PageLoader'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * One group: its roster, its games, and its leaderboard.
 *
 * The three tabs mirror the Group → Game → Mode scoping the stats use
 * (plan §3) — the leaderboard only means anything relative to a mode.
 */
export function GroupDetailPage() {
  const { slug } = useParams()

  const { data: group, isLoading } = useQuery({
    queryKey: queryKeys.groups.detail(slug),
    queryFn: () => groupsApi.get(slug),
  })

  const { data: players } = useQuery({
    queryKey: queryKeys.groups.players(slug),
    queryFn: () => groupsApi.players(slug),
    enabled: Boolean(group),
  })

  const { data: standings } = useQuery({
    queryKey: ['groups', slug, 'standings'],
    queryFn: () => groupsApi.standings(slug),
    enabled: Boolean(group),
  })

  if (isLoading) return <PageLoader label="Loading group…" />

  if (!group) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          title="Group not found"
          description="It may have been deleted, or you may no longer be a member."
          actionLabel="Back to groups"
          actionTo={paths.groups}
        />
      </div>
    )
  }

  const roster = players ?? []
  const rows = standings ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title={group.name} description={group.description || undefined} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Leaderboard */}
        <section className="card bg-base-100 border-base-300 border md:col-span-2">
          <div className="card-body p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4" />
              Leaderboard
            </h2>

            {rows.length === 0 ? (
              <p className="text-base-content/50 py-4 text-center text-sm">
                Ratings appear once this group has played some tournaments.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-sm table">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Player</th>
                      <th className="text-right">Rating</th>
                      <th className="text-right">W</th>
                      <th className="text-right">L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.player_id} className="hover">
                        <td className="text-base-content/50 tabular">{index + 1}</td>
                        <td className="font-medium">{row.display_name}</td>
                        <td className="tabular text-right font-semibold">{row.elo}</td>
                        <td className="tabular text-right">{row.wins}</td>
                        <td className="tabular text-right">{row.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Roster */}
        <section className="card bg-base-100 border-base-300 border">
          <div className="card-body p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" />
              Roster
              <span className="badge badge-ghost badge-sm ml-auto">{roster.length}</span>
            </h2>

            {roster.length === 0 ? (
              <p className="text-base-content/50 py-3 text-sm">Nobody added yet.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {roster.map((player) => (
                  <li key={player.id} className="flex items-center justify-between text-sm">
                    <span>{player.display_name}</span>
                    {player.linked && <span className="badge badge-outline badge-xs">linked</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Games */}
        <section className="card bg-base-100 border-base-300 border">
          <div className="card-body p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Gamepad2 className="h-4 w-4" />
              Games
              <span className="badge badge-ghost badge-sm ml-auto">{group.games?.length ?? 0}</span>
            </h2>

            {!group.games?.length ? (
              <p className="text-base-content/50 py-3 text-sm">
                No games yet. Stats are tracked per game and mode.
              </p>
            ) : (
              <ul className="mt-1 space-y-2">
                {group.games.map((game) => (
                  <li key={game.id}>
                    <p className="text-sm font-medium">{game.name}</p>
                    {game.modes?.length > 0 && (
                      <p className="text-base-content/50 text-xs">
                        {game.modes.map((m) => m.name).join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
