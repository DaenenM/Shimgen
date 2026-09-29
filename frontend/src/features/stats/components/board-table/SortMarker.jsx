import { ArrowDown, ArrowUp } from '@/components/icons'

// Sort arrow with a reserved slot, so headers don't shift width on sort. Used by BoardTable.jsx and ColumnHeader.jsx.
export function SortMarker({ active, descending }) {
  const Arrow = descending ? ArrowDown : ArrowUp

  return (
    <span className="grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
      {active && <Arrow className="h-3 w-3" />}
    </span>
  )
}
