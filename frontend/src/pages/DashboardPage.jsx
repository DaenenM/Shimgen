import { useQuery } from '@tanstack/react-query'
import { Plus, Shuffle, Trophy, UserPlus, Users } from '@/components/icons'
import { Link } from 'react-router-dom'

import {
  friends as friendsApi,
  roster as rosterApi,
  tournaments as tournamentsApi,
} from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FORMAT_LABELS } from '@/features/bracket/layout'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * The signed-in landing page.
 *
 * Answers "what happened, and what do I do next" — recent events plus the two
 * actions that start a game night. Deliberately not a wall of statistics: this
 * is a page people pass through on the way to running something.
 */
export function DashboardPage() {
  const { user } = useAuth()

  const { data: tournaments } = useQuery({
    queryKey: queryKeys.tournaments.all,
    queryFn: () => tournamentsApi.list(),
  })

  const { data: players } = useQuery({
    queryKey: queryKeys.roster.all,
    queryFn: () => rosterApi.list(),
  })

  const { data: pending } = useQuery({
    queryKey: ['friends', 'pending'],
    queryFn: friendsApi.pending,
  })

  const events = list(tournaments)
  const recent = events.slice(0, 5)
  const active = events.filter((t) => t.state === 'active').length

  return (
    <div className="glass-backdrop mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title={`Welcome back, ${user?.display_name || user?.username}`}
        description="Pick up where you left off, or start something new."
      >
        <Link
          to={paths.quickStart}
          className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          New tournament
        </Link>
        <Link
          to={paths.teamGenerator}
          className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          <Shuffle className="h-4 w-4" />
          Teams
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Tournaments" value={events.length} to={paths.tournaments} />
        <Stat label="In progress" value={active} to={paths.tournaments} />
        <Stat label="Saved players" value={list(players).length} to={paths.roster} />
      </div>

      {/* A pending friend request is the one thing here that needs an answer,
          so it gets a prompt rather than sitting silently in a counter. */}
      {list(pending).length > 0 && (
        <Link
          to={paths.friends}
          className="glass-inset hover:border-base-content/25 hover:bg-base-content/5 mb-6 flex items-center gap-2.5 p-3 text-sm transition-colors duration-200"
        >
          <UserPlus className="text-primary h-4 w-4" />
          <span>
            You have {list(pending).length} pending friend{' '}
            {list(pending).length === 1 ? 'request' : 'requests'}.
          </span>
        </Link>
      )}

      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase opacity-60">
        Recent tournaments
      </h2>

      {recent.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nothing yet"
          description="Paste in some names and you'll have a bracket in about ten seconds."
          actionLabel="Create your first"
          actionTo={paths.quickStart}
        />
      ) : (
        <ul className="grid gap-2">
          {recent.map((tournament) => (
            <li key={tournament.id}>
              <Link
                to={paths.tournament(tournament.id, tournament.title)}
                className="glass-panel hover:border-base-content/25 hover:bg-base-content/5 p-4 transition-colors duration-200"
              >
                <div className="flex flex-row items-center justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tournament.title || 'Untitled tournament'}
                    </p>
                    <p className="text-base-content/50 text-xs">
                      {FORMAT_LABELS[tournament.format] ?? tournament.format} ·{' '}
                      {tournament.entrant_count} entrants
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                      tournament.state === 'active'
                        ? 'bg-success/15 text-success'
                        : 'bg-base-content/8 text-base-content/60'
                    }`}
                  >
                    {tournament.state}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Paginated endpoints return {results}; unpaginated ones return an array. */
function list(data) {
  return data?.results ?? data ?? []
}

function Stat({ label, value, to }) {
  return (
    <Link
      to={to}
      className="glass-panel hover:border-base-content/25 hover:bg-base-content/5 p-4 transition-colors duration-200"
    >
      <div className="p-4">
        <p className="text-base-content/50 text-xs">{label}</p>
        <p className="tabular text-2xl font-bold">{value}</p>
      </div>
    </Link>
  )
}
