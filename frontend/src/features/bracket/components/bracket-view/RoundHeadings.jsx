import { roundLabel, roundTone } from '../../utils/layout'
import { RoundPill } from './RoundPill'

// Heading row above a section's columns, spaced to match the cards below.
// Used by BracketSection.jsx and DoubleEliminationLayout.jsx.
export function RoundHeadings({ columns, totalRounds, size, section }) {
  if (columns.length <= 1) return null

  return (
    <div className="mb-2 flex min-w-min">
      {columns.map(({ roundNo }, index) => (
        <div key={roundNo} className="flex">
          {/* One spacer per gap, mirroring the connector each column draws. */}
          {index > 0 && <span className={`${size.gap} shrink-0`} />}
          <RoundPill
            label={roundLabel(roundNo, totalRounds, section, index + 1)}
            tone={roundTone(roundNo, totalRounds, section)}
            size={size}
          />
        </div>
      ))}
    </div>
  )
}
