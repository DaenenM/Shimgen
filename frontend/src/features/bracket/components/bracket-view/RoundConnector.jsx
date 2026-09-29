const LINE = 'border-base-content/25'

// The connector line(s) arriving at one match card. Used by BracketRound.jsx.
// Two arms: the left draws the bracket corner-riser-corner between two
// feeders' centres, the right runs flat from the riser's middle into the card.
export function RoundConnector({ count, size }) {
  // No feeders (e.g. a losers round whose byes were all hidden) — draw nothing.
  if (count === 0) return <span className={`${size.gap} shrink-0`} />

  // One feeder: a flat line straight across at the card's centre.
  if (count === 1) {
    return (
      <span className={`${size.gap} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t`} />
      </span>
    )
  }

  return (
    <span className={`${size.gap} flex shrink-0 items-stretch`}>
      <span className={`${size.arm} flex shrink-0 flex-col`}>
        <span className="flex flex-1 flex-col">
          <span className="flex-1" />
          <span className={`${LINE} flex-1 rounded-tr border-t border-r`} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className={`${LINE} flex-1 rounded-br border-r border-b`} />
          <span className="flex-1" />
        </span>
      </span>

      {/* Flat run into the card, from the seam between the two halves above. */}
      <span className={`${size.arm} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t`} />
      </span>
    </span>
  )
}
