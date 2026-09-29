import { Check, Plus, User, Users, X } from '@/components/icons'

/**
 * The roster as a checklist: click a name to put them on the team or take
 * them off.
 *
 * The same row structure as the saved roster rail: one name per line, a tick
 * that becomes a cross on hover, and the glyphs that say which rows are you
 * and which are friends. A wrapped field of pills made a long roster
 * unreadable and hid that distinction entirely.
 */
export function RosterChecklist({ players, selected, onToggle }) {
  if (players.length === 0) {
    return (
      <p className="text-base-content/40 mt-3 py-3 text-center text-sm">
        Your roster is empty — type a name above to start one.
      </p>
    )
  }

  return (
    <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
      {players.map((player) => {
        const picked = selected.has(player.id)

        return (
          <li key={player.id ?? player.display_name} className="group flex items-center">
            <button
              type="button"
              onClick={() => onToggle(player.id)}
              aria-pressed={picked}
              title={picked ? `Remove ${player.display_name}` : `Add ${player.display_name}`}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 ${
                picked
                  ? 'text-success hover:bg-error/10 hover:text-error'
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {picked ? (
                // Tick at rest, cross on hover, both in one slot so the
                // row does not reflow as they swap.
                <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
                  <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
                  <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </span>
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
              )}
              <span className="truncate font-medium">{player.display_name}</span>

              {player.is_self ? (
                <User
                  className="text-accent ml-auto h-3.5 w-3.5 shrink-0"
                  aria-label="You"
                  role="img"
                />
              ) : (
                player.is_friend && (
                  <Users
                    className="text-primary ml-auto h-3.5 w-3.5 shrink-0"
                    aria-label="Friend"
                    role="img"
                  />
                )
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
