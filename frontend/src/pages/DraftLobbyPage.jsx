import { ArrowLeft } from '@/components/icons'
import { Link, useParams } from 'react-router-dom'

import { PageShell } from '@/components/layout/PageShell'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { DraftFinish } from '@/features/draft/DraftFinish'
import { DraftPool } from '@/features/draft/DraftPool'
import { DraftTeamCard } from '@/features/draft/DraftTeamCard'
import { useDraftLobby } from '@/features/draft/useDraftLobby'
import { paths } from '@/routes/paths'

/**
 * The captain draft: a pool of players, and captains taking turns to pick.
 *
 * This page exists because a drafted tournament has no bracket yet — entrants
 * are created only once every player has a team, so there is nothing for the
 * bracket page to render until the draft ends. Step 6 of the flow: the last
 * pick makes this page redundant and it hands over to the bracket.
 *
 * One device, passed around the room. Whoever is captain taps their own pick,
 * or the host taps for them — which is how a group at one table actually
 * drafts, and it needs no accounts at all, so an anonymous quick-start host can
 * use captains mode like anyone else.
 */
export function DraftLobbyPage() {
  const { id } = useParams()
  const { tournament, draft, isLoading, pick, undo, complete, error } = useDraftLobby(id)

  if (isLoading) return <SkeletonPage width="max-w-4xl" />

  // Only the irreversible step waits on the network. Picking and undoing are
  // applied to the cache immediately, so disabling them while a request is in
  // flight would reintroduce the pause this page is meant not to have — and a
  // fast run of picks is exactly the normal case.
  const busy = complete.isPending
  const ready = draft.pool.length === 0
  const current = draft.teams.find((team) => team.is_picking)

  // Not a spectator link: this route is gated like any other view of the
  // tournament, so it opens only for the host, a captain, or somebody in the
  // pool. It saves them hunting through their tournament list.
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

      <div className="rise-in rise-delay-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tournament?.title || 'Team draft'}
          </h1>

          {/* The turn indicator is the most important thing on the page: with
              one device being passed around, whoever is holding it needs to
              know at a glance whether it is their turn. */}
          <p className="text-base-content/60 mt-1 text-sm">
            {ready ? (
              <>Every player has a team. Review the sides below, then build the bracket.</>
            ) : (
              <>
                <span className="text-primary font-semibold">{current?.captain_label}</span> picks —{' '}
                {draft.picks_remaining} left
              </>
            )}
          </p>
        </div>

        {/* A friend added to the pool has no way of knowing until their own
            browser asks again, so handing them the link beats telling them to
            go and look. */}
        <CopyLinkButton
          url={lobbyUrl}
          label="Share lobby"
          title="Copy a link to this lobby for the people in the draft"
          className="shrink-0"
        />
      </div>

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
              // Building the bracket is a host action on the server, so the
              // control is a host control here.
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
