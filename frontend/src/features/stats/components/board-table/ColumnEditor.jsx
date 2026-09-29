import { useState } from 'react'

import { Pencil, Trash2 } from '@/components/icons'

import { Popover } from './Popover'

/**
 * Rename a column and change its mark, in place.
 *
 * Deliberately not a modal: the header is where a column's name is read, so it
 * is where changing it belongs — and a dialog for two short fields is more
 * chrome than the edit deserves.
 *
 * `role` is not offered. What a column counts is structural, and the serializer
 * refuses it for the reason its own comment gives: changing it would silently
 * rewrite what the numbers already in it meant.
 */
export function ColumnEditor({ column, onSave, onRemove }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(column.name)
  const [emoji, setEmoji] = useState(column.emoji)

  const commit = () => {
    const next = name.trim()
    const changed = (next && next !== column.name) || emoji !== column.emoji

    if (changed) onSave({ name: next || column.name, emoji })
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Edit the ${column.name} column`}
      title="Rename or change the mark"
      icon={<Pencil className="h-3 w-3" />}
    >
      <span className="flex flex-col gap-2 p-0.5">
        <input
          className="glass-inset focus:border-primary/50 h-8 w-full px-2 text-sm font-normal transition-colors focus:outline-none"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setName(column.name)
              setEmoji(column.emoji)
              setOpen(false)
            }
          }}
          aria-label="Column name"
        />

        <input
          className="glass-inset focus:border-primary/50 h-8 w-full px-2 text-sm font-normal transition-colors focus:outline-none"
          value={emoji}
          maxLength={16}
          onChange={(event) => setEmoji(event.target.value)}
          aria-label="Column mark"
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={commit}
            className="bg-primary text-primary-content hover:bg-primary/90 h-8 flex-1 rounded-lg text-xs font-semibold transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(column.name)
              setEmoji(column.emoji)
              setOpen(false)
            }}
            className="text-base-content/60 hover:bg-base-content/8 h-8 rounded-lg px-2 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
            aria-label={`Delete the ${column.name} column`}
            title="Delete this column"
            className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </span>
    </Popover>
  )
}
