import { useParams } from 'react-router-dom'

import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { BracketView } from '@/features/bracket/components/bracket-view/BracketView'
import { EntrantRoster } from '@/features/bracket/components/EntrantRoster'
import { RoundList } from '@/features/bracket/components/RoundList'
import { SpectatorHeader } from '@/features/bracket/components/spectator/SpectatorHeader'
import { SpectatorSidebar } from '@/features/bracket/components/spectator/SpectatorSidebar'
import { useSpectatorBracket } from '@/features/bracket/hooks/useSpectatorBracket'
import { paths } from '@/routes/paths'

const LIST_FORMATS = new Set(['rr', 'swiss'])

// Public read-only bracket (plan §4, NEW 2). Route: /t/:publicSlug/:name?
// No account, no controls. Reuses BracketView with canReport={false} so
// this view can't drift out of sync with the host's.
export function SpectatorPage() {
  const { publicSlug } = useParams()
  const { tournament, standings, eliminated, isLoading } = useSpectatorBracket(publicSlug)

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

  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Only the title block animates — the bracket updates live and shouldn't twitch. */}
      <SpectatorHeader tournament={tournament} className="rise-in mb-6" />

      {/* Same layout as the host's view: standings left, bracket centre. */}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <SpectatorSidebar
          standings={standings}
          className="rise-in rise-delay-2 order-2 lg:order-1"
        />

        <div className="rise-in rise-delay-3 order-1 min-w-0 lg:order-2">
          {LIST_FORMATS.has(tournament.format) ? (
            <RoundList matches={tournament.matches} canReport={false} />
          ) : (
            <BracketView matches={tournament.matches} canReport={false} />
          )}
        </div>
      </div>

      <EntrantRoster entrants={tournament.entrants} eliminated={eliminated} />
    </PageShell>
  )
}
