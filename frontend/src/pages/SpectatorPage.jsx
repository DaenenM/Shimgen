import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from '@/components/icons'
import { useParams } from 'react-router-dom'

import { spectate } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { BracketView } from '@/features/bracket/BracketView'
import { EntrantRoster } from '@/features/bracket/EntrantRoster'
import { RoundList } from '@/features/bracket/RoundList'
import { StandingsTable } from '@/features/bracket/StandingsTable'
import { FORMAT_LABELS } from '@/features/bracket/layout'
import { useTournamentSocket } from '@/hooks/useTournamentSocket'
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
 * Live over a socket rather than polling. This is the page most likely to be
 * left open on a second screen while somebody else reports results, so a score
 * that lags half a minute behind the room is exactly the wrong failure — and
 * it is the page with the most viewers, so a request every thirty seconds per
 * viewer was the most wasteful place to poll.
 *
 * Styled like the rest of the site. It had been left on the old DaisyUI cards
 * and buttons while every other page moved to the glass surfaces, which made
 * the one page strangers actually land on look like a different product.
 */
export function SpectatorPage() {
  const { publicSlug } = useParams()
  const queryClient = useQueryClient()

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['spectate', publicSlug],
    queryFn: () => spectate.get(publicSlug),
  })

  const { data: standings } = useQuery({
    queryKey: ['spectate', publicSlug, 'standings'],
    queryFn: () => spectate.standings(publicSlug),
    enabled: Boolean(tournament),
  })

  // Keyed by id rather than the slug the URL carries: the socket groups are per
  // tournament id, and the spectator payload includes it. `enabled` keeps the
  // hook from opening a connection before the first fetch answers.
  useTournamentSocket(
    tournament?.id,
    () => {
      queryClient.invalidateQueries({ queryKey: ['spectate', publicSlug] })
      queryClient.invalidateQueries({ queryKey: ['spectate', publicSlug, 'standings'] })
    },
    { enabled: Boolean(tournament?.id) },
  )

  if (isLoading) return <SkeletonPage width="max-w-[92rem]" />

  if (!tournament) {
    return (
      <PageShell className="glass-backdrop">
        <EmptyState
          title="No bracket here"
          description="This link may be wrong, or the tournament may have been deleted."
          actionLabel="Go to Shimgen"
          actionTo={paths.home}
        />
      </PageShell>
    )
  }

  const isList = LIST_FORMATS.has(tournament.format)

  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* The title block only. The bracket beside it is replaced whenever a
          result lands, and animating that would make the page twitch at
          somebody watching a friend's tournament — the last place a flourish
          belongs. */}
      <div className="rise-in mb-6">
        <div className="glass-inset text-base-content/60 mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
          <Eye className="h-3.5 w-3.5" />
          Spectator view
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tournament.title || 'Tournament'}
        </h1>
        <p className="text-base-content/60 mt-1 text-sm">
          {FORMAT_LABELS[tournament.format] ?? tournament.format} · {tournament.entrants.length}{' '}
          entrants
          <span
            className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
              tournament.state === 'active'
                ? 'bg-success/15 text-success'
                : 'bg-base-content/8 text-base-content/60'
            }`}
          >
            {tournament.state === 'active' && (
              <span className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />
            )}
            {tournament.state}
          </span>
        </p>

        {tournament.description && (
          <p className="text-base-content/70 mt-3 text-sm">{tournament.description}</p>
        )}
      </div>

      {/* Same shape as the host's view: standings left, bracket centre. */}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="rise-in rise-delay-2 order-2 space-y-4 lg:order-1">
          <div className="glass-panel">
            <div className="p-4">
              <h3 className="mb-2 text-sm font-semibold">Standings</h3>
              <StandingsTable rows={standings} />
            </div>
          </div>

          {/* The whole point of a spectator link: someone watching a friend's
              bracket is the best lead this product gets (plan §4, NEW 2). */}
          <div className="glass-panel">
            <div className="flex flex-col items-center p-4 text-center">
              <p className="text-base-content/60 text-xs">Running your own game nights?</p>
              <Button to={paths.quickStart} size="sm" className="mt-2">
                Build a bracket
              </Button>
            </div>
          </div>
        </aside>

        <div className="rise-in rise-delay-3 order-1 min-w-0 lg:order-2">
          {isList ? (
            <RoundList matches={tournament.matches} canReport={false} />
          ) : (
            <BracketView matches={tournament.matches} canReport={false} />
          )}
        </div>
      </div>

      <EntrantRoster entrants={tournament.entrants} />
    </PageShell>
  )
}
