import { Archive, ChevronDown } from '@/components/icons'
import { useState } from 'react'

import { TournamentCard } from './TournamentCard'

/**
 * Archived tournaments, folded under the main list.
 *
 * A disclosure rather than a mode. The previous toggle swapped the whole page
 * over to archived and swapped the header's meaning with it, which on a phone
 * was a 32px icon nobody found — and once found, left no way back except the
 * same invisible control. Archived tournaments are a footnote to the list, so
 * they live under it.
 *
 * Only rendered when something is actually archived. A permanent empty
 * disclosure is a control that never does anything, and the count is what
 * makes it worth a tap.
 */
export function ArchivedTournaments({ items, cardHandlers }) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="border-base-content/10 mt-8 border-t pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-base-content/70 hover:text-base-content hover:bg-base-content/8 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors duration-200"
      >
        <Archive className="h-4 w-4 shrink-0" />
        <span>Archived tournaments</span>

        {/* The count sits in the label so the section says how much is behind
            it before it is opened. */}
        <span className="bg-base-content/10 text-base-content/70 rounded-full px-2 py-0.5 text-xs">
          {items.length}
        </span>

        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <ul className="mt-2 grid gap-2">
          {items.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              archived
              {...cardHandlers}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
