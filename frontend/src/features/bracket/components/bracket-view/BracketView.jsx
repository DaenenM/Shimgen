import { sectionsFor } from '../../utils/layout'
import { BracketSection } from './BracketSection'
import { DoubleEliminationLayout } from './DoubleEliminationLayout'

// Elimination bracket: columns of matches joined by connector lines. Used by
// TournamentDetailPage.jsx and SpectatorPage.jsx. With a grand final, winners/losers/final
// render as one connected grid; otherwise each section scrolls on its own.
export function BracketView({ matches, canReport, onReport = () => {}, onClear = () => {} }) {
  const sections = sectionsFor(matches)
  const joined = sections.includes('final') && sections.includes('main')
  const standalone = joined
    ? sections.filter((s) => !['main', 'losers', 'final'].includes(s))
    : sections

  return (
    <div className="space-y-6 sm:space-y-8">
      {joined && (
        <DoubleEliminationLayout
          matches={matches}
          canReport={canReport}
          onReport={onReport}
          onClear={onClear}
        />
      )}
      {standalone.map((section) => (
        <BracketSection
          key={section}
          section={section}
          matches={matches}
          showHeading={sections.length > 1}
          canReport={canReport}
          onReport={onReport}
          onClear={onClear}
        />
      ))}
    </div>
  )
}
