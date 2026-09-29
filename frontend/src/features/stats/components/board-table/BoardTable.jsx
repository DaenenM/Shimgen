import { useState } from 'react'

import { useDragScroll } from '@/hooks/useDragScroll'
import { useIsSmallScreen } from '@/hooks/useMediaQuery'

import { NAME_KEY, ariaSort } from '../../utils/columns'
import { BoardRow } from './BoardRow'
import { ColumnHeader } from './ColumnHeader'
import { SortMarker } from './SortMarker'

/**
 * One section of a board — "Solo", "Teams".
 *
 * Sorted by the leading column to begin with, so the board reads as a standing:
 * the person in front is at the top, which is the whole reason anyone looks at
 * it. Any header re-sorts by that column, and clicking the same one again
 * flips the direction.
 */
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

  // Phones always count in numbers: seven tridents in a 90px column wrap into
  // an unreadable smear, which is exactly what a real Pummel Party tally looks
  // like on a phone.
  const isSmall = useIsSmallScreen()

  // Drag the table sideways by its background. The tally cells and sort headers
  // are buttons, so the hook leaves them alone — a mis-aimed tap on `+1` is
  // still a tap on `+1`, however much the hand moves afterwards.
  const scroller = useDragScroll()

  /**
   * How a cell draws itself.
   *
   * A single tally column is the "Brett: 🔱🔱🔱🔱" board — the emoji row is the
   * whole point, and it reads at a glance. Two or more columns is a table, and
   * two rows of glyphs side by side stop being readable: at that width the eye
   * cannot compare six tridents against four. So a table with more than one
   * column counts in numbers, whatever each column was set to — and so does any
   * column on a screen too narrow to lay marks out.
   */
  const displayFor = (column) =>
    column.display === 'number' || columns.length > 1 || isSmall ? 'number' : 'emoji'

  // `null` means "the leading column, descending" — the default standing. Held
  // per table, so sorting one section does not reorder the others.
  const [sort, setSort] = useState(null)

  /**
   * What the board leads with before anyone clicks a header.
   *
   * Trophies first when the table has them. A tournament board's columns come
   * out in role order — played, won, lost, tournaments won — so the leftmost
   * column is "games played", and leading with it ranks whoever turned up most
   * rather than whoever won. Tournaments won is the standing everyone actually
   * came to see.
   *
   * Falls back to the first column for a hand-counted board, which has no
   * trophy column and whose first column is the thing it was made to count.
   */
  const trophyColumn = columns.find((column) => column.role === 'tournaments_won')

  // The key is an id, not a column object: the name column is sortable too and
  // has no column row behind it, so looking one up would come back undefined
  // and silently sort everything by the same value.
  const sortKey = sort ? sort.key : (trophyColumn?.id ?? columns[0]?.id ?? NAME_KEY)
  const descending = sort ? sort.descending : true

  function toggle(key) {
    setSort((current) =>
      // Same column: flip. A different one starts descending for tallies —
      // "most wins first" is what a click on a number column means — and
      // ascending for names, where A-Z is the natural first reading.
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

    // Ties keep their existing order rather than shuffling on every render.
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

  // A narrow table has no business scrolling sideways.
  //
  // `min-w-[28rem]` is what four automatic columns need to stay readable, but
  // applied to a phone it forced 448px into a 343px viewport: the table
  // scrolled sideways, the name column sat pinned at 160px, and the single
  // value column was handed the ~290px left over — a number 24px wide adrift in
  // the middle of it.
  //
  // Screen size alone decides it. Folding the column count in as well was a
  // mistake: a one-column board on a desktop then took the narrow path, which
  // squeezes the value cell to `w-px` — and a column of eight trophies, given
  // no width, wrapped to one glyph per line. The emoji tally is exactly what
  // the roomy layout exists for, so any wide screen gets it whatever the board
  // holds. `displayFor` already switches to numbers on a phone, so the marks
  // that needed the width are not being drawn on the narrow path anyway.
  const wide = !isSmall

  return (
    <div ref={scroller} className={wide ? 'overflow-x-auto' : ''}>
      <table className={`w-full border-collapse ${wide ? 'min-w-[28rem]' : ''}`}>
        <thead>
          <tr className="border-base-content/10 border-b">
            <th
              // Fluid rather than fixed on a narrow board, so the name takes
              // the room it needs and the tally keeps the rest.
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
              // The board exists to say who is in front, so the front row is
              // marked — but only when the sort still means "in front". Sort by
              // name, or ascending, and the top row is just the first one
              // alphabetically or the worst score, which is not a lead.
              //
              // Only first. Tinting the top three flattens the gap between the
              // winner and the pack, which is the one thing a standing is for.
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
