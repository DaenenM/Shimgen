import { useQuery } from '@tanstack/react-query'
import { Plus, Shuffle, Trophy, UserPlus } from '@/components/icons'
import { Link } from 'react-router-dom'

import {
  friends as friendsApi,
  roster as rosterApi,
  tournaments as tournamentsApi,
} from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { TournamentCard } from '@/features/tournaments/TournamentCard'
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

  const { data: tournaments, isLoading } = useQuery({
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
  const pendingCount = list(pending).length

  return (
    <PageShell className="glass-backdrop">
      <PageHeader
        title={`Welcome back, ${user?.display_name || user?.username}`}
        description="Pick up where you left off, or start something new."
      >
        <Button icon={Plus} to={paths.quickStart}>
          New tournament
        </Button>
        <Button icon={Shuffle} variant="secondary" to={paths.teamGenerator}>
          Teams
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Tournaments" value={events.length} to={paths.tournaments} />
        <Stat label="In progress" value={active} to={paths.tournaments} />
        <Stat label="Saved players" value={list(players).length} to={paths.roster} />
      </div>

      {/* A pending friend request is the one thing here that needs an answer,
          so it gets a prompt rather than sitting silently in a counter. */}
      {pendingCount > 0 && (
        <Link
          to={paths.friends}
          className="glass-inset hover:border-base-content/25 hover:bg-base-content/5 mb-6 flex items-center gap-2.5 px-4 py-3 text-sm transition-colors duration-200"
        >
          <UserPlus className="text-primary h-4 w-4 shrink-0" />
          <span>
            You have {pendingCount} pending friend {pendingCount === 1 ? 'request' : 'requests'}.
          </span>
        </Link>
      )}

      <h2 className="text-base-content/60 mb-3 text-sm font-semibold tracking-wide uppercase">
        Recent tournaments
      </h2>

      {isLoading ? (
        // Only the list waits. The header, its actions and the counters are
        // above and already interactive, so the page is usable before the
        // fetch lands.
        <SkeletonRows count={3} />
      ) : recent.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nothing yet"
          description="Paste in some names and you'll have a bracket in about ten seconds."
          actionLabel="Create your first"
          actionTo={paths.quickStart}
        />
      ) : (
        // The same row the tournaments list uses, rather than a second version
        // of it. The two pages showed the same tournaments in two different
        // shapes — different pills, a different state badge, a different
        // surface — which read as two different products.
        <ul className="grid gap-2">
          {recent.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              // The dashboard is a glance, not a workbench: pinning, archiving
              // and deleting all live on the tournaments page, one tap away.
              readOnly
            />
          ))}
        </ul>
      )}
    </PageShell>
  )
}

/** Paginated endpoints return {results}; unpaginated ones return an array. */
function list(data) {
  return data?.results ?? data ?? []
}

/**
 * One headline number, linking to the page behind it.
 *
 * `glass-inset` rather than `glass-panel`: these sit three across in a row of
 * small tiles, and a full panel's 20px blur plus drop shadow made them read as
 * three floating cards rather than one band of figures.
 */
function Stat({ label, value, to }) {
  return (
    <Link
      to={to}
      className="glass-inset hover:border-base-content/25 hover:bg-base-content/5 px-4 py-3.5 transition-colors duration-200"
    >
      <p className="text-base-content/50 text-xs">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-bold">{value}</p>
    </Link>
  )
}
