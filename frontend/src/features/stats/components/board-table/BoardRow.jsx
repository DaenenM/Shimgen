import { Trash2 } from '@/components/icons'

import { ROLE_TONE } from '../../utils/columns'
import { AccountBadge } from './AccountBadge'
import { RowName } from './RowName'
import { SwapRow } from './SwapRow'
import { TallyCell } from './TallyCell'

/** One competitor's line on a board. */
export function BoardRow({
  row,
  table,
  leading,
  wide,
  displayFor,
  canEdit,
  editing,
  friends,
  busyKey,
  onAward,
  onRemoveRow,
  onSwapRow,
  onRenameRow,
  onUnlinkRow,
}) {
  const { columns } = table

  return (
    <tr
      className={`group/row border-base-content/8 hover:bg-base-content/5 relative border-b transition-colors duration-150 last:border-0 ${
        leading ? 'bg-accent/[0.06]' : ''
      }`}
    >
      <td className={`relative px-3 py-2 ${wide ? '' : 'max-w-0'}`}>
        {leading && (
          <span className="bg-accent absolute inset-y-0 left-0 w-0.5" aria-hidden="true" />
        )}
        {/* `block truncate` inside the `max-w-0` cell above is what makes a
            long name give way instead of widening a narrow table. On desktop
            the name column is a fixed `w-40`, so it keeps the plain inline
            treatment it always had — applying both there collapsed the column
            and let the tally sprawl across it. */}
        <span className="flex min-w-0 items-center gap-1.5">
          {/* Every row can be renamed, linked or not. The label is this board's
              own name for somebody — a crew calling Brett "Bretty" on their
              Pummel Party table is the point, not a mistake — and it overrides
              the account name only here. The account link and the tallies are
              untouched. */}
          {editing && onRenameRow ? (
            // Keyed on the name so a swap re-seeds the box: the draft is state,
            // and state survives a prop change — without this the field kept
            // the old name after swapping in a friend, which is exactly when
            // you want to see theirs.
            <RowName
              key={row.display_name}
              name={row.display_name}
              onRename={(label) => onRenameRow(row.id, label)}
            />
          ) : (
            <span className={wide ? 'font-medium' : 'truncate font-medium'}>
              {row.display_name}
            </span>
          )}

          {(row.is_self || row.is_friend) && (
            <AccountBadge
              row={row}
              onUnlink={editing && onUnlinkRow ? () => onUnlinkRow(row.id) : null}
            />
          )}

          {editing && onSwapRow && (
            <SwapRow
              row={row}
              friends={friends}
              taken={table.rows}
              onSwap={(playerId, label) => onSwapRow(row.id, playerId, label)}
            />
          )}
        </span>
      </td>

      {columns.map((column) => (
        <td
          key={column.id}
          className={`py-2 ${wide ? 'px-3' : 'w-px px-2'} ${ROLE_TONE[column.role] ?? ''}`}
        >
          <TallyCell
            count={row.counts?.[column.id] ?? 0}
            emoji={column.emoji}
            display={displayFor(column)}
            // Automatic columns are computed from the bracket, so they have no
            // +/- : editing one by hand would be overwritten the next time a
            // result was reported, which is worse than not offering it.
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
  )
}
