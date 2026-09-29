import { Plus, Shuffle } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { FriendRequestPrompt } from '@/features/dashboard/components/FriendRequestPrompt'
import { RecentTournaments } from '@/features/dashboard/components/RecentTournaments'
import { StatTile } from '@/features/dashboard/components/StatTile'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { paths } from '@/routes/paths'

// Signed-in landing page. Route: /dashboard
// Recent tournaments plus the two actions that start a game night.
export function DashboardPage() {
  const { user } = useAuth()
  const { recent, counts, isLoading } = useDashboard()

  return (
    <PageShell className="glass-backdrop">
      {/* Frame animates, not the list — the list re-renders on every invalidation. */}
      <div className="rise-in rise-delay-1">
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
      </div>

      <div className="rise-in rise-delay-2 mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="Tournaments" value={counts.tournaments} to={paths.tournaments} />
        <StatTile label="In progress" value={counts.active} to={paths.tournaments} />
        <StatTile label="Saved players" value={counts.players} to={paths.roster} />
      </div>

      <FriendRequestPrompt count={counts.pendingFriends} className="rise-in rise-delay-3 mb-6" />

      <h2 className="text-base-content/60 rise-in rise-delay-4 mb-3 text-sm font-semibold tracking-wide uppercase">
        Recent tournaments
      </h2>

      <RecentTournaments tournaments={recent} isLoading={isLoading} />
    </PageShell>
  )
}
