import { sectionsFor } from '../../utils/layout'
import { BracketSection } from './BracketSection'

/**
 * An elimination bracket, as columns of matches joined by connector lines.
 *
 * Cards shrink as a bracket deepens, and only then. A four-column draw is drawn
 * at full size; a five- or six-column one steps down so the whole shape fits a
 * laptop without side-scrolling — see `SIZES`. Past that the scroller remains,
 * because a phone cannot hold six columns at any size worth reading.
 * Each section (winners, losers, grand final) is its own scroller so the losers
 * bracket does not drag the winners bracket sideways with it.
 *
 * The connectors are drawn with borders rather than SVG. Every pair of cards in
 * a round is wrapped in a flex column that splits the available height evenly,
 * so a card in the next round lands exactly on the midpoint between its two
 * feeders without anything being measured — the browser's own layout does the
 * arithmetic, and it stays right when a card grows a best-of footer.
 */
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
