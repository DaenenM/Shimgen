import { ArrowDown, ArrowUp, Trash2, Zap } from '@/components/icons'
import { useState } from 'react'

import { useIsSmallScreen } from '@/hooks/useMediaQuery'

import { TallyCell } from './TallyCell'

// The name column sorts like the others but has no StatsColumn behind it, so it
// needs a key that cannot collide with a real column id.
const NAME_KEY = 'name'

/**
 * One section of a board — "Solo", "Teams".
 *
 * Sorted by the leading column to begin with, so the board reads as a standing:
 * the person in front is at the top, which is the whole reason anyone looks at
 * it. Any header re-sorts by that column, and clicking the same one again
 * flips the direction.
 */
export function BoardTable({ table, canEdit, onAward, onRemoveRow, busyKey }) {
  const { columns, rows } = table

  // Phones always count in numbers: seven tridents in a 90px column wrap into
  // an unreadable smear, which is exactly what a real Pummel Party tally looks
  // like on a phone.
  const isSmall = useIsSmallScreen()

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

  /** The arrow shown on whichever header is currently sorting. */
  const marker = (key) =>
    sortKey === key ? (
      descending ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUp className="h-3 w-3" />
      )
    ) : null

  if (columns.length === 0) {
    return (
      <p className="text-base-content/50 py-6 text-center text-sm">
        This table has no columns yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse">
        <thead>
          <tr className="border-base-300 border-b">
            <th
              className="w-40 px-3 py-2 text-left"
              aria-sort={sortKey === NAME_KEY ? (descending ? 'descending' : 'ascending') : 'none'}
            >
              <button
                type="button"
                onClick={() => toggle(NAME_KEY)}
                className="hover:text-base-content flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors"
              >
                <span className="text-base-content/50">Player</span>
                {marker(NAME_KEY)}
              </button>
            </th>

            {columns.map((column) => (
              <th
                key={column.id}
                className="px-3 py-2 text-left"
                aria-sort={
                  sortKey === column.id ? (descending ? 'descending' : 'ascending') : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => toggle(column.id)}
                  title={`Sort by ${column.name}`}
                  // Centred over centred values, so a numeric column reads as
                  // one aligned block rather than a header adrift of its data.
                  className={`hover:text-base-content flex w-full items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                    displayFor(column) === 'number' ? 'justify-center' : ''
                  }`}
                >
                  <span className="text-base" aria-hidden="true">
                    {column.emoji}
                  </span>
                  <span className="text-base-content/70">{column.name}</span>
                  {column.role !== 'manual' && (
                    <span
                      title="Kept up to date by linked tournaments"
                      className="text-primary/70 normal-case"
                      aria-label="Updated automatically"
                    >
                      <Zap className="h-3 w-3" />
                    </span>
                  )}
                  {marker(column.id)}
                </button>
              </th>
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

          {sorted.map((row) => (
            <tr
              key={row.id}
              className="group/row border-base-300/60 hover:bg-base-200/40 border-b transition-colors last:border-0"
            >
              <td className="px-3 py-2">
                <span className="truncate font-medium">{row.display_name}</span>
              </td>

              {columns.map((column) => (
                <td key={column.id} className="px-3 py-2">
                  <TallyCell
                    count={row.counts?.[column.id] ?? 0}
                    emoji={column.emoji}
                    display={displayFor(column)}
                    // Automatic columns are computed from the bracket, so they
                    // have no +/- : editing one by hand would be overwritten
                    // the next time a result was reported, which is worse than
                    // not offering it.
                    canEdit={canEdit && column.role === 'manual'}
                    busy={busyKey === `${row.id}:${column.id}`}
                    onAward={(delta) => onAward(row.id, column.id, delta)}
                  />
                </td>
              ))}

              {canEdit && (
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row)}
                    aria-label={`Remove ${row.display_name}`}
                    className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-7 w-7 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover/row:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
