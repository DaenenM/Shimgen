import { useState } from 'react'

import { Archive, ChevronDown } from '@/components/icons'

import { TournamentCard } from './tournament-card/TournamentCard'

// Archived tournaments, folded under the main list as a disclosure. Used by
// TournamentsPage.jsx. Renders nothing if there's nothing archived.
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
