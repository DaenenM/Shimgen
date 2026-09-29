import { useState } from 'react'

import { Plus } from '@/components/icons'

// Typed-name entry field for TeamEditor. Adds a name to the team via onAdd.
export function AddNameForm({ onAdd }) {
  const [typed, setTyped] = useState('')

  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onAdd(typed)
        setTyped('')
      }}
    >
      <input
        className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 min-w-0 flex-1 px-3 text-sm transition-colors focus:outline-none"
        placeholder="Add a name"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        aria-label="Add a player by name"
      />
      <button
        type="submit"
        disabled={!typed.trim()}
        className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Add this name"
      >
        <Plus className="h-4 w-4" />
      </button>
    </form>
  )
}
