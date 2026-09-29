import { Link, useParams } from 'react-router-dom'

import { ArrowLeft } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { DraftFinish } from '@/features/draft/components/DraftFinish'
import { DraftHeader } from '@/features/draft/components/DraftHeader'
import { DraftPool } from '@/features/draft/components/DraftPool'
import { DraftTeamCard } from '@/features/draft/components/DraftTeamCard'
import { useDraftLobby } from '@/features/draft/hooks/useDraftLobby'
import { paths } from '@/routes/paths'

// Captain draft lobby. Route: /tournaments/:id/draft/:name?
// Entrants aren't created until the draft ends, so there's no bracket to
// show until then. One device passed around the room; no account needed.
export function DraftLobbyPage() {
  const { id } = useParams()
  const { tournament, draft, isLoading, pick, undo, complete, error } = useDraftLobby(id)

  if (isLoading) return <SkeletonPage width="max-w-4xl" />

  // Only the irreversible "complete" step waits on the network.
  const busy = complete.isPending
  const ready = draft.pool.length === 0
  const current = draft.teams.find((team) => team.is_picking)

  // Gated like any other tournament view — not a public spectator link.
  const lobbyUrl = `${window.location.origin}${paths.draft(id, tournament?.title)}`

  return (
    <PageShell width="wide" className="glass-backdrop">
      <Link
        to={paths.tournaments}
        className="text-base-content/60 hover:text-base-content rise-in rise-delay-1 mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All tournaments
      </Link>

      <DraftHeader
        tournament={tournament}
        draft={draft}
        current={current}
        ready={ready}
        lobbyUrl={lobbyUrl}
        className="rise-in rise-delay-2 mb-6"
      />

      <ErrorAlert className="rise-in rise-delay-2 mb-4">{error?.message}</ErrorAlert>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="rise-in rise-delay-3 self-start">
          <DraftPool
            draft={draft}
            disabled={busy}
            onPick={(name) => pick.mutate(name)}
            onUndo={() => undo.mutate()}
          />
        </div>

        <div className="rise-in rise-delay-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.teams.map((team, index) => (
              <DraftTeamCard
                key={team.id}
                team={team}
                expectedSize={draft.expected_sizes?.[index]}
              />
            ))}
          </div>

          <div className="mt-5">
            <DraftFinish
              // Building the bracket is a host-only action.
              isHost={Boolean(tournament?.is_host)}
              ready={ready}
              picksRemaining={draft.picks_remaining}
              complete={complete}
            />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
