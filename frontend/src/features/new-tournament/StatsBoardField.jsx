import { BarChart3 } from '@/components/icons'
import { useState } from 'react'

import { Select } from '@/components/ui/Select'
import { useBoards } from '@/features/stats/useBoards'

import { TABLE_SEPARATOR } from './payload'

// A select value that cannot collide with a board slug, so "make a new one" can
// live in the same control as the boards themselves.
const NEW_BOARD = '__new__'

/**
 * "Connect Stats Board" — where this bracket's results should also land.
 *
 * Linking to a board is what makes a league night count for something past
 * Saturday. The caller renders this signed-in only, since an anonymous bracket
 * has no board of its own to feed.
 */
export function StatsBoardField({ value, onChange }) {
  const { boards, create } = useBoards()
  const [making, setMaking] = useState(false)
  const [name, setName] = useState('')

  // Only boards the host may write to, and only boards built to receive a
  // tournament.
  //
  // Linking a hand-counted board does not merely record alongside the tally —
  // it gives that table the four automatic columns a bracket fills, which is a
  // structural change to a board somebody made to count by hand. Leaving it out
  // of the list keeps the board the thing its owner built.
  const editable = boards.filter(
    (board) => (board.role === 'owner' || board.role === 'editor') && board.tracks_tournaments,
  )

  /**
   * Make a board without leaving the form.
   *
   * Always a tournament board: it exists to receive this bracket's results, so
   * asking whether it should be hand-counted would be offering an answer that
   * cannot be right. Selected on success, which is the only reason to have made
   * it.
   */
  function createBoard() {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), tracks_tournaments: true },
      {
        onSuccess: (board) => {
          onChange(board.slug)
          setMaking(false)
          setName('')
        },
      },
    )
  }

  return (
    <div className="glass-inset p-3">
      <span className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <BarChart3 className="h-4 w-4" />
        Connect Stats Board
      </span>

      {making ? (
        <div className="flex gap-2">
          <input
            className="glass-raised focus:border-primary/50 h-9 min-w-0 flex-1 px-3 text-sm transition-colors focus:outline-none"
            placeholder="Board name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createBoard()
              }
              if (e.key === 'Escape') setMaking(false)
            }}
            aria-label="New board name"
          />
          <button
            type="button"
            className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 shrink-0 place-items-center rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
            disabled={!name.trim() || create.isPending}
            onClick={createBoard}
          >
            {create.isPending ? <span className="loading loading-spinner loading-xs" /> : 'Create'}
          </button>
          <button
            type="button"
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            onClick={() => setMaking(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <Select
          label="Stats board"
          value={value}
          onChange={(next) => {
            if (next === NEW_BOARD) setMaking(true)
            else onChange(next)
          }}
          options={[
            { value: '', label: 'No stat board' },
            ...editable.flatMap(boardOptions),
            { value: NEW_BOARD, label: '+ New board…', action: true },
          ]}
        />
      )}

      {create.isError && <p className="text-error mt-1.5 text-xs">{create.error.message}</p>}
    </div>
  )
}

/**
 * A board with several tournament tables is listed one table at a time —
 * "Pummel Party — Solo wins". With one table there is nothing to choose
 * between, so the board's own name is the option and the server picks the
 * table.
 */
function boardOptions(board) {
  const tables = (board.tables_summary ?? []).filter((table) => table.tracks_tournaments)

  if (tables.length <= 1) return [{ value: board.slug, label: board.name }]

  return tables.map((table) => ({
    value: `${board.slug}${TABLE_SEPARATOR}${table.id}`,
    label: `${board.name} — ${table.name}`,
  }))
}
