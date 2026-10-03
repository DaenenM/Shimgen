const LINE = 'border-base-content/25'

// Line pieces joining the winners final and losers final to the grand final.
// Used by DoubleEliminationLayout.jsx; each `part` fills one grid cell.
//   trail    flat line from a section's last card to the connector column
//   junction winners line into the grand final, riser starting below it
//   riser    vertical line carrying the losers line up between sections
//   elbow    losers line turning upward into the riser
//   flat     grand final → bracket reset (dashed until the reset is live)
export function FinalsConnector({ part, size, withRiser = true, dashed = false }) {
  if (part === 'trail') {
    return (
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <span className={`${LINE} block border-t`} />
      </span>
    )
  }

  if (part === 'flat') {
    return (
      <span className={`${size.gap} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t ${dashed ? 'border-dashed' : ''}`} />
      </span>
    )
  }

  if (part === 'riser') {
    return (
      <span className={`${size.gap} flex shrink-0`}>
        <span className={`${size.arm} ${LINE} shrink-0 border-r`} />
      </span>
    )
  }

  // junction / elbow: left arm draws the turn, right arm the run into the grand final.
  const elbow = part === 'elbow'

  return (
    <span className={`${size.gap} flex shrink-0 items-stretch`}>
      <span className={`${size.arm} flex shrink-0 flex-col`}>
        <span className={`${LINE} flex-1 border-b ${elbow ? 'rounded-br border-r' : ''}`} />
        <span className={`${LINE} flex-1 ${!elbow && withRiser ? 'border-r' : ''}`} />
      </span>
      <span className={`${size.arm} flex shrink-0 flex-col justify-center`}>
        {!elbow && <span className={`${LINE} block border-t`} />}
      </span>
    </span>
  )
}
