import { useState } from 'react'

import { ArrowDown, ArrowUp, Plus, Trash2, UserPlus } from '@/components/icons'

import { AddColumn } from './AddColumn'
import { AddRows } from './AddRows'
import { BoardTable } from './board-table/BoardTable'
import { InlineName } from './InlineName'

const ICON_BUTTON =
  'text-base-content/50 hover:bg-base-content/8 hover:text-base-content grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-25'
const TEXT_BUTTON =
  'text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150'

/**
 * One table on a board, with the controls that only appear in edit mode.
 *
 * `above` and `below` are the neighbouring tables, for swapping positions;
 * `actions` is the object `useBoard` returns.
 */
export function TableCard({ table, above, below, canEdit, editing, roster, busyKey, actions }) {
  const [addingColumn, setAddingColumn] = useState(false)
  const [addingRows, setAddingRows] = useState(false)

  return (
    <div className="glass-panel">
      <div className="card-body gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <InlineName
              name={table.name}
              onRename={(name) => actions.renameTable(table.id, name)}
              label="Table name"
              className="h-10 w-48 text-lg font-semibold"
            />
          ) : (
            <h2 className="text-lg font-semibold">{table.name}</h2>
          )}

          {editing && (
            <div className="flex items-center gap-2">
              {/* Arrows rather than drag: no new dependency, works from the
                  keyboard, and a board holds a handful of tables. Disabled at
                  the ends rather than hidden, so the cluster keeps its width. */}
              <div className="flex items-center">
                <button
                  className={ICON_BUTTON}
                  onClick={() => actions.moveTable(table, above)}
                  disabled={!above}
                  aria-label={`Move the ${table.name} table up`}
                  title="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  className={ICON_BUTTON}
                  onClick={() => actions.moveTable(table, below)}
                  disabled={!below}
                  aria-label={`Move the ${table.name} table down`}
                  title="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <button className={TEXT_BUTTON} onClick={() => setAddingRows((on) => !on)}>
                <UserPlus className="h-4 w-4" />
                Players
              </button>
              <button className={TEXT_BUTTON} onClick={() => setAddingColumn((on) => !on)}>
                <Plus className="h-4 w-4" />
                Column
              </button>
              <button
                className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150"
                onClick={() => actions.removeTable(table.id)}
                aria-label={`Delete the ${table.name} table`}
                title="Delete this table"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {addingRows && editing && (
          // Stays open across adds. Adding players is done in a run — a name
          // from the roster, three more pasted, one typed — and closing after
          // each one meant reopening the panel for every person.
          <AddRows
            roster={roster}
            existing={table.rows}
            onAdd={(payload) => actions.addRows(table.id, payload)}
            onDone={() => setAddingRows(false)}
          />
        )}

        {addingColumn && editing && (
          <AddColumn
            onAdd={(payload) => {
              actions.addColumn(table.id, payload)
              setAddingColumn(false)
            }}
            onCancel={() => setAddingColumn(false)}
          />
        )}

        <BoardTable
          table={table}
          canEdit={canEdit}
          editing={editing}
          busyKey={busyKey}
          onAward={actions.award}
          onRemoveRow={(row) => actions.removeRow(row.id)}
          onEditColumn={actions.updateColumn}
          onRemoveColumn={actions.removeColumn}
          onSwapRow={actions.swapRow}
          onRenameRow={actions.renameRow}
          onUnlinkRow={actions.unlinkRow}
          // Friends and yourself. Swapping a row onto somebody's account
          // attaches their record to this board, and a friendship is the
          // consent that makes that reasonable — your own account needs no
          // such permission, and tallying yourself under a typed name is
          // exactly as common as doing it for somebody else.
          friends={roster.filter((player) => player.is_friend || player.is_self)}
        />
      </div>
    </div>
  )
}
