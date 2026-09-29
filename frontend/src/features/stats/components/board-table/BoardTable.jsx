import { useState } from 'react'

import { useDragScroll } from '@/hooks/useDragScroll'
import { useIsSmallScreen } from '@/hooks/useMediaQuery'

import { NAME_KEY, ariaSort } from '../../utils/columns'
import { BoardRow } from './BoardRow'
import { ColumnHeader } from './ColumnHeader'
import { SortMarker } from './SortMarker'

// One table/section of a board (e.g. "Solo", "Teams"). Used by TableCard.jsx.
// Sorted by the leading column by default; click a header to sort by it, click again to flip.
export function BoardTable({
  table,
  canEdit,
  editing,
  friends = [],
  onAward,
  onRemoveRow,
  onEditColumn,
  onRemoveColumn,
  onSwapRow,
  onRenameRow,
  onUnlinkRow,
  busyKey,
}) {
  const { columns, rows } = table

  // Phones count in numbers: emoji marks wrap into an unreadable smear at that width.
  const isSmall = useIsSmallScreen()

  // Drags the table sideways by its background; tally/sort buttons are unaffected.
  const scroller = useDragScroll()

  // Multiple columns, or a small screen, can't lay out emoji marks readably — use numbers.
  const displayFor = (column) =>
    column.display === 'number' || columns.length > 1 || isSmall ? 'number' : 'emoji'

  // null means "leading column, descending" (the default standing). Per-table state.
  const [sort, setSort] = useState(null)

  // Tournament boards lead with tournaments-won rather than games-played (the first column).
  // Hand-counted boards have no trophy column, so they fall back to the first column.
  const trophyColumn = columns.find((column) => column.role === 'tournaments_won')

  // Key is an id, not a column object, since the name column has no column row behind it.
  const sortKey = sort ? sort.key : (trophyColumn?.id ?? columns[0]?.id ?? NAME_KEY)
  const descending = sort ? sort.descending : true

  function toggle(key) {
    setSort((current) =>
      // Same column flips direction; a new one defaults to descending for tallies, ascending for names.
      current && current.key === key
        ? { key, descending: !current.descending }
        : { key, descending: key !== NAME_KEY },
    )
  }

  const value = (row) =>
    sortKey === NAME_KEY ? row.display_name.toLowerCase() : (row.counts?.[sortKey] ?? 0)

  const sorted = [...rows].sort((a, b) => {
    const left = value(a)
    const right = value(b)

    // Ties keep existing order instead of shuffling on every render.
    if (left === right) return rows.indexOf(a) - rows.indexOf(b)

    const ahead = left > right ? 1 : -1
    return descending ? -ahead : ahead
  })

  if (columns.length === 0) {
    return (
      <p className="text-base-content/50 py-6 text-center text-sm">
        This table has no columns yet.
      </p>
    )
  }

  // Screen size alone decides wide vs. narrow layout (not column count too — a
  // one-column desktop board taking the narrow path squeezed trophy columns unreadably).
  const wide = !isSmall

  return (
    <div ref={scroller} className={wide ? 'overflow-x-auto' : ''}>
      <table className={`w-full border-collapse ${wide ? 'min-w-[28rem]' : ''}`}>
        <thead>
          <tr className="border-base-content/10 border-b">
            <th
              // Fluid width on narrow boards so the name takes only the room it needs.
              className={`px-3 py-2 text-left ${wide ? 'w-40' : 'w-auto'}`}
              aria-sort={ariaSort(NAME_KEY, sortKey, descending)}
            >
              <button
                type="button"
                onClick={() => toggle(NAME_KEY)}
                className="hover:text-base-content flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors"
              >
                <span className="text-base-content/50">Player</span>
                <SortMarker active={sortKey === NAME_KEY} descending={descending} />
              </button>
            </th>

            {columns.map((column) => (
              <ColumnHeader
                key={column.id}
                column={column}
                wide={wide}
                numeric={displayFor(column) === 'number'}
                sortKey={sortKey}
                descending={descending}
                onSort={toggle}
                editing={editing}
                onEdit={onEditColumn}
                onRemove={onRemoveColumn}
              />
            ))}

            {canEdit && <th className="w-10" />}
          </tr>
        </thead>

        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (canEdit ? 2 : 1)}
                className="text-base-content/50 px-3 py-8 text-center text-sm"
              >
                No players yet.
              </td>
            </tr>
          )}

          {sorted.map((row, index) => (
            <BoardRow
              key={row.id}
              row={row}
              table={table}
              // Marks the top row, but only when the sort actually means "in the lead"
              // (not sorted by name or ascending). Only the first row, not top few.
              leading={index === 0 && sortKey !== NAME_KEY && descending && sorted.length > 1}
              wide={wide}
              displayFor={displayFor}
              canEdit={canEdit}
              editing={editing}
              friends={friends}
              busyKey={busyKey}
              onAward={onAward}
              onRemoveRow={onRemoveRow}
              onSwapRow={onSwapRow}
              onRenameRow={onRenameRow}
              onUnlinkRow={onUnlinkRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
