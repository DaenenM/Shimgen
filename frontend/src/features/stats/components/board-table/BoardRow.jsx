import { Trash2 } from '@/components/icons'

import { ROLE_TONE } from '../../utils/columns'
import { AccountBadge } from './AccountBadge'
import { RowName } from './RowName'
import { SwapRow } from './SwapRow'
import { TallyCell } from './TallyCell'

// One competitor's row on a board table. Used by BoardTable.jsx.
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
        {/* `truncate` only applies in the narrow (`max-w-0`) layout, not the fixed-width desktop one. */}
        <span className="flex min-w-0 items-center gap-1.5">
          {/* Row label overrides the account name here only; the link and tallies are untouched. */}
          {editing && onRenameRow ? (
            // Keyed on name so swapping in a friend re-seeds the draft with theirs.
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
            // Automatic columns are bracket-computed; no +/- since a hand edit would be overwritten.
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
