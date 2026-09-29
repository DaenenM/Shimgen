import { sectionsFor } from '../../utils/layout'
import { BracketSection } from './BracketSection'

// Elimination bracket: columns of matches joined by connector lines. Used by
// TournamentDetailPage.jsx and SpectatorPage.jsx. Cards shrink as the bracket
// deepens to fit without scrolling (see SIZES in layout.js). Each section
// (winners/losers/grand final) scrolls independently. Connectors are CSS
// borders on flex columns, not SVG, so they stay aligned without measuring.
export function BracketView({ matches, canReport, onReport = () => {}, onClear = () => {} }) {
  const sections = sectionsFor(matches)

  return (
    <div className="space-y-6 sm:space-y-8">
      {sections.map((section) => (
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
