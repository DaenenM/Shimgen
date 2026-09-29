import { ArrowDown, ArrowUp } from '@/components/icons'

/**
 * The sort arrow, in a slot that is always there.
 *
 * Returning `null` for an unsorted column meant the arrow appeared and
 * disappeared from the flex row, so every click widened one header and shoved
 * the rest of the table sideways — the whole grid twitched on each sort. The
 * slot is now reserved whatever the state, and only its contents change.
 */
export function SortMarker({ active, descending }) {
  const Arrow = descending ? ArrowDown : ArrowUp

  return (
    <span className="grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
      {active && <Arrow className="h-3 w-3" />}
    </span>
  )
}
