import { useState } from 'react'

/**
 * Pick the mark a column stamps.
 *
 * A short list of the things people actually tally with, plus a free field —
 * a full emoji keyboard would be a lot of chrome for a choice made once per
 * column, and the native picker is one keyboard shortcut away for anything
 * exotic.
 */
const SUGGESTIONS = [
  '\u{1F531}', // trident
  '⚜️', // fleur-de-lis
  '\u{1F3C6}', // trophy
  '⭐', // star
  '\u{1F525}', // fire
  '\u{1F480}', // skull
  '\u{1F451}', // crown
  '\u{1F947}', // 1st place
  '\u{1F948}', // 2nd place
  '\u{1F949}', // 3rd place
  '⚽', // football
  '\u{1F3AF}', // dart
]

export function EmojiPicker({ value, onChange }) {
  const [custom, setCustom] = useState('')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            aria-label={`Use ${emoji}`}
            aria-pressed={value === emoji}
            className={`grid h-9 w-9 place-items-center rounded-lg border text-lg transition-all duration-150 ${
              value === emoji
                ? 'border-primary bg-primary/15 scale-105'
                : 'border-base-300 hover:border-primary/50 hover:bg-base-200'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <input
        className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 w-full px-3 text-sm transition-colors focus:outline-none"
        placeholder="Or paste any emoji"
        value={custom}
        maxLength={16}
        onChange={(e) => {
          setCustom(e.target.value)
          const next = e.target.value.trim()
          if (next) onChange(next)
        }}
        aria-label="Custom emoji"
      />
    </div>
  )
}
