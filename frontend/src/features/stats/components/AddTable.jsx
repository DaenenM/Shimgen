import { useState } from 'react'

import { Plus } from '@/components/icons'

import { EmojiPicker } from './EmojiPicker'

/** A second section on the board — "Teams" alongside "Solo". */
export function AddTable({ onAdd, pending }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('⚜️')
  // Two genuinely different kinds of table, and the choice decides what the
  // table can do afterwards, so it is made here rather than buried in settings.
  const [tracks, setTracks] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-base-content/15 text-base-content/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-medium transition-colors duration-150"
      >
        <Plus className="h-4 w-4" />
        Add a table
      </button>
    )
  }

  return (
    <div className="glass-panel mt-5">
      <div className="card-body gap-3 p-4">
        <label className="flex w-full flex-col">
          <span className="label-text mb-1 text-sm">Table name</span>
          <input
            className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 w-full px-3 text-sm transition-colors focus:outline-none"
            placeholder="Teams"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            [false, 'Counted by hand', 'You add each win yourself.'],
            [true, 'From tournaments', 'Games and wins fill in by themselves.'],
          ].map(([value, label, hint]) => (
            <label
              key={String(value)}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                tracks === value
                  ? 'border-primary bg-primary/5'
                  : 'glass-inset hover:border-base-content/25'
              }`}
            >
              <input
                type="radio"
                name="table-kind"
                className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                checked={tracks === value}
                onChange={() => setTracks(value)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-base-content/50 block text-xs">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {/* A tracking table's columns come with their own marks, so there is
            nothing to choose here. */}
        {!tracks && (
          <div>
            <span className="label-text mb-1.5 block text-sm">Mark for its first column</span>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="bg-primary text-primary-content hover:bg-primary/90 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
            disabled={!name.trim() || pending}
            onClick={() => {
              onAdd({ name: name.trim(), emoji, tracks_tournaments: tracks })
              setOpen(false)
              setName('')
            }}
          >
            <Plus className="h-4 w-4" />
            Add table
          </button>
          <button
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
