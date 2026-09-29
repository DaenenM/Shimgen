import { useState } from 'react'

import { Button } from '@/components/ui/Button'

// Paste-a-list import (plan §4, NEW 8): newlines or commas, blanks dropped. Used by RosterPage.jsx.
export function PasteNames({ onAdd, onClose }) {
  const [pasted, setPasted] = useState('')

  function submit() {
    const names = pasted
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length) onAdd(names)
    onClose()
  }

  return (
    <div className="glass-inset mb-4 space-y-2 p-3">
      <textarea
        className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-28 w-full resize-none p-3 font-mono text-sm transition-colors focus:outline-none"
        placeholder={'One name per line, or comma separated\nMark\nDaniel\nJacob'}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit}>
          Add them
        </Button>
      </div>
    </div>
  )
}
