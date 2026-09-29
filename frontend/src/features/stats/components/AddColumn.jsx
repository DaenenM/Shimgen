import { useState } from 'react'

import { Plus } from '@/components/icons'

import { EmojiPicker } from './EmojiPicker'

// Form for naming a new column and picking its mark. Used by TableCard.jsx.
export function AddColumn({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('\u{1F531}')

  // Single row layout keeps a two-word answer from looking like a big form.
  return (
    <div className="glass-inset space-y-2 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 w-40 px-3 text-sm transition-colors focus:outline-none"
          placeholder="Column name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onAdd({ name: name.trim(), emoji })
            if (e.key === 'Escape') onCancel()
          }}
          aria-label="Column name"
        />

        <span className="text-base-content/40 text-xs">marked</span>

        <span className="grid h-9 w-9 shrink-0 place-items-center text-lg" aria-hidden="true">
          {emoji}
        </span>

        <div className="ml-auto flex gap-2">
          <button
            className="bg-primary text-primary-content hover:bg-primary/90 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
            disabled={!name.trim()}
            onClick={() => onAdd({ name: name.trim(), emoji })}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          <button
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      <EmojiPicker value={emoji} onChange={setEmoji} />
    </div>
  )
}
