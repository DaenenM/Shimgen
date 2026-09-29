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

/**
 * The public bracket (plan §4, NEW 2).
 *
 * No account, no controls — the organiser signs up and nine friends just click
 * a link. Reusing BracketView with `canReport={false}` rather than writing a
 * separate read-only renderer means the spectator view cannot drift out of step
 * with the real one.
 *
 * Styled like the rest of the site. It had been left on the old DaisyUI cards
 * and buttons while every other page moved to the glass surfaces, which made
 * the one page strangers actually land on look like a different product.
 */
export function SpectatorPage() {
  const { publicSlug } = useParams()
  const { tournament, standings, isLoading } = useSpectatorBracket(publicSlug)

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
      {/* The title block only. The bracket beside it is replaced whenever a
          result lands, and animating that would make the page twitch at
          somebody watching a friend's tournament — the last place a flourish
          belongs. */}
      <SpectatorHeader tournament={tournament} className="rise-in mb-6" />

      {/* Same shape as the host's view: standings left, bracket centre. */}
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

      <EntrantRoster entrants={tournament.entrants} />
    </PageShell>
  )
}
