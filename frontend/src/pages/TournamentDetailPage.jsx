import { useParams } from 'react-router-dom'

import { Users } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BracketView } from '@/features/bracket/components/bracket-view/BracketView'
import { EntrantRoster } from '@/features/bracket/components/EntrantRoster'
import { RoundList } from '@/features/bracket/components/RoundList'
import { RulesCard } from '@/features/bracket/components/RulesCard'
import { StandingsSection } from '@/features/bracket/components/StandingsSection'
import { TournamentHeader } from '@/features/bracket/components/TournamentHeader'
import { useBracketReporting } from '@/features/bracket/hooks/useBracketReporting'
import { useTournamentDetail } from '@/features/bracket/hooks/useTournamentDetail'
import { paths } from '@/routes/paths'

// Formats with no tree to draw: nobody is eliminated, so a bracket layout
// would imply a structure that is not there.
const LIST_FORMATS = new Set(['rr', 'swiss'])

export function TournamentDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const detail = useTournamentDetail(id)
  const { tournament, standings, isLoading, actionError } = detail
  const { syncError, saveState, onReport, onClear } = useBracketReporting(id, tournament)

  if (isLoading) return <SkeletonPage width="max-w-[92rem]" />

  if (!tournament) {
    return (
      <PageShell width="wide" className="glass-backdrop">
        <EmptyState
          title="Tournament not found"
          description="It may have been deleted, or the link may be wrong."
          actionLabel="Back to tournaments"
          actionTo={paths.tournaments}
        />
      </PageShell>
    )
  }

  const isList = LIST_FORMATS.has(tournament.format)
  const canReport = tournament.can_report
  const Matches = isList ? RoundList : BracketView

  return (
    <PageShell width="wide" className="glass-backdrop">
      <TournamentHeader
        tournament={tournament}
        user={user}
        isList={isList}
        // A rejected save must not keep showing a checkmark.
        saveState={syncError ? 'idle' : saveState}
        actions={detail}
      />

      {tournament.description && (
        <p className="text-base-content/70 mb-6 text-sm">{tournament.description}</p>
      )}

      <ErrorAlert className="mb-4">{syncError ?? actionError?.message}</ErrorAlert>

      {!canReport && tournament.state !== 'draft' && (
        <div className="glass-inset mb-6 px-3 py-2 text-sm">
          You're viewing this as a spectator. Only the host and co-hosts can report results.
        </div>
      )}

      {/* The bracket takes the full width. Standings used to hold a 16rem
          column beside it, which cost the bracket a whole round of horizontal
          room on a laptop — and standings are what you read after a result,
          not while clicking one. They now sit below, next to the entrants. */}
      <div className={`grid gap-6 ${tournament.rules ? 'lg:grid-cols-[1fr_18rem]' : ''}`}>
        <div className="min-w-0">
          {tournament.matches.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No bracket yet"
              description="This tournament has entrants but no matches. Generate the bracket to get started."
            />
          ) : (
            <Matches
              matches={tournament.matches}
              canReport={canReport}
              onReport={onReport}
              onClear={onClear}
            />
          )}
        </div>

        {/* Rules only. The spectator link lives on the Share button — a
            permanent card for a URL nobody reads was dead weight. */}
        {tournament.rules && <RulesCard rules={tournament.rules} />}
      </div>

      {/* Standings and the roster share the bottom row: both are things you
          read once the bracket has moved, and side by side they fill the width
          that a single full-bleed list would waste. */}
      <div className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-[20rem_1fr]">
        <StandingsSection rows={standings} />
        <EntrantRoster entrants={tournament.entrants} />
      </div>
    </PageShell>
  )
}
