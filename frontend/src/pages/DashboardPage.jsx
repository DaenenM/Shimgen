import { useQuery } from '@tanstack/react-query'
import { Plus, Shuffle, Trophy, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  friends as friendsApi,
  groups as groupsApi,
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
    queryFn: tournamentsApi.list,
  })

  const { data: groups } = useQuery({
    queryKey: queryKeys.groups.all,
    queryFn: groupsApi.list,
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title={`Welcome back, ${user?.display_name || user?.username}`}
        description="Pick up where you left off, or start something new."
      >
        <Link to={paths.quickStart} className="btn btn-primary btn-sm gap-2">
          <Plus className="h-4 w-4" />
          New tournament
        </Link>
        <Link to={paths.teamGenerator} className="btn btn-outline btn-sm gap-2">
          <Shuffle className="h-4 w-4" />
          Teams
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Tournaments" value={events.length} to={paths.tournaments} />
        <Stat label="In progress" value={active} to={paths.tournaments} />
        <Stat label="Saved players" value={list(players).length} to={paths.roster} />
        <Stat label="Groups" value={list(groups).length} to={paths.groups} />
      </div>

      {/* A pending friend request is the one thing here that needs an answer,
          so it gets a prompt rather than sitting silently in a counter. */}
      {list(pending).length > 0 && (
        <Link
          to={paths.friends}
          className="alert bg-base-100 border-base-300 mb-6 flex border py-2 text-sm hover:shadow-sm"
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
                className="card bg-base-100 border-base-300 border transition-shadow hover:shadow-md"
              >
                <div className="card-body flex-row items-center justify-between gap-4 p-3">
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
                    className={`badge badge-sm ${
                      tournament.state === 'complete'
                        ? 'badge-success'
                        : tournament.state === 'active'
                          ? 'badge-primary'
                          : 'badge-ghost'
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

      {list(groups).length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={Users}
            title="Create a group to track stats"
            description="Stats and ratings are scoped to a crew: your Saturday regulars, your LoL customs. Tournaments work fine without one, but nothing accumulates."
            actionLabel="Create a group"
            actionTo={paths.groups}
          />
        </div>
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
      className="card bg-base-100 border-base-300 border transition-shadow hover:shadow-md"
    >
      <div className="card-body p-4">
        <p className="text-base-content/50 text-xs">{label}</p>
        <p className="tabular text-2xl font-bold">{value}</p>
      </div>
    </Link>
  )
}
