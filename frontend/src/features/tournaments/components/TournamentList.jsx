import { Trophy } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { paths } from '@/routes/paths'

import { TournamentCard } from './tournament-card/TournamentCard'

// Live tournaments, or an empty state explaining their absence. Used by TournamentsPage.jsx.
export function TournamentList({ isAuthenticated, isLoading, items, cardHandlers }) {
  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={Trophy}
        title="Your tournaments live in your account"
        description="You can build a bracket without signing up, but an account is what keeps it, along with your roster and stats, for next Saturday."
        actionLabel="Create a bracket"
        actionTo={paths.quickStart}
      />
    )
  }

  // The header and its "New tournament" button are above and already
  // interactive: only the list is waiting on the server.
  if (isLoading) return <SectionLoader label="Loading your tournaments…" />

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No tournaments yet"
        description="Paste in some names and you'll have a bracket in about ten seconds."
        actionLabel="Create your first"
        actionTo={paths.quickStart}
      />
    )
  }

  return (
    <ul className="grid gap-2">
      {items.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} {...cardHandlers} />
      ))}
    </ul>
  )
}
