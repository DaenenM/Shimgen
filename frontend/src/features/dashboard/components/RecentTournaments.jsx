import { Trophy } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { TournamentCard } from '@/features/tournaments/components/tournament-card/TournamentCard'
import { paths } from '@/routes/paths'

/** The last few tournaments, as the same rows the tournaments page uses. */
export function RecentTournaments({ tournaments, isLoading }) {
  // Only the list waits. The header, its actions and the counters are above
  // and already interactive, so the page is usable before the fetch lands.
  if (isLoading) return <SkeletonRows count={3} />

  if (tournaments.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Nothing yet"
        description="Paste in some names and you'll have a bracket in about ten seconds."
        actionLabel="Create your first"
        actionTo={paths.quickStart}
      />
    )
  }

  return (
    // The same row the tournaments list uses, rather than a second version of
    // it. The two pages showed the same tournaments in two different shapes —
    // different pills, a different state badge, a different surface — which
    // read as two different products.
    <ul className="grid gap-2">
      {tournaments.map((tournament) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          // The dashboard is a glance, not a workbench: pinning, archiving and
          // deleting all live on the tournaments page, one tap away.
          readOnly
        />
      ))}
    </ul>
  )
}
