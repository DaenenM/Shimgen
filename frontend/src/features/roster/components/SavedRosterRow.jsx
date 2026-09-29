import { Archive, Check, Plus, Trash2, User, Users, X } from '@/components/icons'

// One player in the saved roster: click to add/remove, plus archive/delete on hover.
// Used by SavedRoster.jsx. `teamColor` tints an added player in their team's colour.
export function SavedRosterRow({ player, added, teamColor, onAdd, onRemove, onArchive, onForget }) {
  return (
    <li className="group flex items-center">
      <button
        type="button"
        onClick={() => (added ? onRemove(player.display_name) : onAdd(player.display_name))}
        // Toggles rather than disables, so a mis-click can be undone the same way.
        aria-pressed={added}
        title={added ? `Remove ${player.display_name}` : `Add ${player.display_name}`}
        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 ${
          added
            ? `${teamColor ? 'text-(--team)' : 'text-success'} hover:bg-error/10 hover:text-error`
            : 'hover:bg-primary/10 hover:text-primary'
        }`}
        // Set as a variable, not `color`, so the red hover can still override it.
        style={teamColor ? { '--team': teamColor } : undefined}
      >
        {added ? (
          // Tick at rest, cross on hover, same slot to avoid reflow.
          <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
            <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
            <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          </span>
        ) : (
          <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
        )}
        <span className="truncate font-medium">{player.display_name}</span>

        {/* Friends only, not merely linked (a co-host who claimed a bracket isn't a friend). */}
        {player.is_self ? (
          <User
            // Amber matches the roster page's own linked-account icon.
            className="text-accent ml-auto h-3.5 w-3.5 shrink-0"
            aria-label="You"
            role="img"
          >
            <title>You — adding this attaches your account</title>
          </User>
        ) : (
          player.is_friend && (
            <Users
              className="text-primary ml-auto h-3.5 w-3.5 shrink-0"
              aria-label="Friend"
              role="img"
            >
              <title>Friend — this name follows their account</title>
            </Users>
          )
        )}
      </button>

      {/* Friend or self: archive, not delete — deleting would cascade away their rating history. */}
      {player.is_friend || player.is_self ? (
        <button
          type="button"
          onClick={() => onArchive(player)}
          aria-label={`Archive ${player.display_name}`}
          title="Archive — hides them and keeps their history"
          className="text-base-content/30 hover:text-primary hover:bg-primary/10 mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onForget(player)}
          aria-label={`Delete ${player.display_name} from saved roster`}
          title="Delete from saved roster"
          className="text-base-content/30 hover:text-error hover:bg-error/10 mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}
