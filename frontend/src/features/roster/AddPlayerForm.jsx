import { Plus } from '@/components/icons'
import { useState } from 'react'

/** The one-name-at-a-time input at the top of the roster. */
export function AddPlayerForm({ onAdd }) {
  const [draft, setDraft] = useState('')

  function submit(event) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    onAdd([name])
    setDraft('')
  }

  return (
    <form onSubmit={submit} className="rise-in rise-delay-2 mb-4 flex gap-2">
      <input
        type="text"
        className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 flex-1 px-3 text-sm transition-colors focus:outline-none"
        placeholder="Add a name…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
        aria-label="Add player"
      >
        <Plus className="h-5 w-5" />
      </button>
    </form>
  )
}
