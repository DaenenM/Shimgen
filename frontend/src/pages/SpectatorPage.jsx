import { useQuery } from '@tanstack/react-query'
import { Eye } from '@/components/icons'
import { Link, useParams } from 'react-router-dom'

import { spectate } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { BracketView } from '@/features/bracket/BracketView'
import { EntrantRoster } from '@/features/bracket/EntrantRoster'
import { RoundList } from '@/features/bracket/RoundList'
import { StandingsTable } from '@/features/bracket/StandingsTable'
import { FORMAT_LABELS } from '@/features/bracket/layout'
import { paths } from '@/routes/paths'

const LIST_FORMATS = new Set(['rr', 'swiss', 'ffa'])

/**
 * The public bracket (plan §4, NEW 2).
 *
 * No account, no controls — the organiser signs up and nine friends just click
 * a link. Reusing BracketView with `canReport={false}` rather than writing a
 * separate read-only renderer means the spectator view cannot drift out of step
 * with the real one.
 *
 * It polls rather than pushing: WebSocket live updates are plan §4 NEW 3 and
 * are not built yet, and a bracket left open on a second monitor showing an
 * hour-old score is worse than a request every half minute.
 */
export function SpectatorPage() {
  const { publicSlug } = useParams()

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['spectate', publicSlug],
    queryFn: () => spectate.get(publicSlug),
    refetchInterval: 30_000,
  })

  const { data: standings } = useQuery({
    queryKey: ['spectate', publicSlug, 'standings'],
    queryFn: () => spectate.standings(publicSlug),
    enabled: Boolean(tournament),
    refetchInterval: 30_000,
  })

  if (isLoading) return <SkeletonPage width="max-w-[92rem]" />

  if (!tournament) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          title="No bracket here"
          description="This link may be wrong, or the tournament may have been deleted."
          actionLabel="Go to Shimgen"
          actionTo={paths.home}
        />
      </div>
    )
  }

  const isList = LIST_FORMATS.has(tournament.format)

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-8">
      <div className="mb-6">
        <div className="text-base-content/50 mb-1 flex items-center gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          Spectator view
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tournament.title || 'Tournament'}
        </h1>
        <p className="text-base-content/60 mt-1 text-sm">
          {FORMAT_LABELS[tournament.format] ?? tournament.format} · {tournament.entrants.length}{' '}
          entrants
        </p>

        {tournament.description && (
          <p className="text-base-content/70 mt-3 text-sm">{tournament.description}</p>
        )}
      </div>

      {/* Same shape as the host's view: standings left, bracket centre. */}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="order-2 space-y-4 lg:order-1">
          <div className="card bg-base-100 border-base-300 border">
            <div className="card-body p-4">
              <h3 className="text-sm font-semibold">Standings</h3>
              <StandingsTable rows={standings} />
            </div>
          </div>

          {/* The whole point of a spectator link: someone watching a friend's
              bracket is the best lead this product gets (plan §4, NEW 2). */}
          <div className="card bg-base-100 border-base-300 border">
            <div className="card-body items-center p-4 text-center">
              <p className="text-base-content/60 text-xs">Running your own game nights?</p>
              <Link to={paths.quickStart} className="btn btn-primary btn-sm mt-1">
                Build a bracket
              </Link>
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          {isList ? (
            <RoundList matches={tournament.matches} canReport={false} />
          ) : (
            <BracketView matches={tournament.matches} canReport={false} />
          )}
        </div>
      </div>

      <EntrantRoster entrants={tournament.entrants} />
    </div>
  )
}
