import { Zap } from '@/components/icons'

import { ROLE_TONE, ariaSort } from '../../utils/columns'
import { ColumnEditor } from './ColumnEditor'
import { SortMarker } from './SortMarker'

/** One tally column's header: sorts on click, and edits in place on an editing board. */
export function ColumnHeader({
  column,
  wide,
  numeric,
  sortKey,
  descending,
  onSort,
  editing,
  onEdit,
  onRemove,
}) {
  return (
    <th
      className={`relative py-2 text-left ${wide ? 'px-3' : 'w-px px-2 whitespace-nowrap'}`}
      aria-sort={ariaSort(column.id, sortKey, descending)}
    >
      <button
        type="button"
        onClick={() => onSort(column.id)}
        title={`Sort by ${column.name}`}
        // Centred over centred values, so a numeric column reads as one aligned
        // block rather than a header adrift of its data.
        className={`hover:text-base-content flex w-full items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
          numeric ? 'justify-center' : ''
        }`}
      >
        <span className="text-base" aria-hidden="true">
          {column.emoji}
        </span>
        <span className={ROLE_TONE[column.role] ?? 'text-base-content/70'}>{column.name}</span>
        {column.role !== 'manual' && (
          <span
            title="Kept up to date by linked tournaments"
            className="text-primary/70 normal-case"
            aria-label="Updated automatically"
          >
            <Zap className="h-3 w-3" />
          </span>
        )}
        <SortMarker active={sortKey === column.id} descending={descending} />
      </button>

      {/* Layered under the sort button rather than replacing it: a header still
          sorts while the board is being edited, and a column's name and mark
          are changed from where they are read. */}
      {editing && (
        <ColumnEditor
          column={column}
          onSave={(payload) => onEdit?.(column.id, payload)}
          onRemove={() => onRemove?.(column.id)}
        />
      )}
    </th>
  )
}
