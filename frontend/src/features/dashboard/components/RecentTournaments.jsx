import { Trophy } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { TournamentCard } from '@/features/tournaments/components/tournament-card/TournamentCard'
import { paths } from '@/routes/paths'

// Recent-tournaments list, reusing TournamentCard. Used by DashboardPage.jsx.
export function RecentTournaments({ tournaments, isLoading }) {
  // Only the list waits; header/counters above are already interactive.
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
    <ul className="grid gap-2">
      {tournaments.map((tournament) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          // Pinning/archiving/deleting live on the tournaments page only.
          readOnly
        />
      ))}
    </ul>
  )
}
