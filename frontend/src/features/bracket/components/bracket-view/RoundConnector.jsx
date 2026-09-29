const LINE = 'border-base-content/25'

/**
 * The arm arriving at one card.
 *
 * Two arms wide, and the two halves do different jobs. The left arm carries the
 * bracket — corner, riser, corner — spanning from one feeder's centre to the
 * other's. The right arm carries a flat line from the middle of that riser into
 * the card. Without the second arm the riser had nowhere to go: it sat hard
 * against the card with no horizontal reaching it, which is the gap that made
 * the bracket look unfinished.
 *
 * The riser starts and stops at the *feeders'* centres, not at the edges of
 * this slot. The slot spans both feeders, so each half of it holds one, and
 * that feeder's centre is the half's own centre — hence the spacer taking the
 * outer half of each. Spanning the slot edge to edge would overshoot the
 * outermost cards by half a slot at each end.
 */
export function RoundConnector({ count, size }) {
  // Nothing upstream — a losers round whose byes were all hidden, say. An arm
  // from nowhere is worse than no arm.
  if (count === 0) return <span className={`${size.gap} shrink-0`} />

  // One feeder: straight across at the card's centre, the full width of the
  // gap. The common case in a losers minor round, and flat is what makes the
  // progression legible.
  if (count === 1) {
    return (
      <span className={`${size.gap} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t`} />
      </span>
    )
  }

  return (
    <span className={`${size.gap} flex shrink-0 items-stretch`}>
      {/* The bracket itself. */}
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

      {/* And the run into the card, from the seam between those two halves —
          which is this card's centre line. */}
      <span className={`${size.arm} flex shrink-0 flex-col justify-center`}>
        <span className={`${LINE} block border-t`} />
      </span>
    </span>
  )
}
