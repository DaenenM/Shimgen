import { User, Users, X } from '@/components/icons'

// Marks a row linked to a real account (self vs. friend). Used by BoardRow.jsx.
// In edit mode, doubles as the unlink control; label and tallies stay when unlinked.
export function AccountBadge({ row, onUnlink }) {
  const Icon = row.is_self ? User : Users
  const tone = row.is_self ? 'text-accent' : 'text-primary'

  if (!onUnlink) {
    return (
      <Icon
        className={`${tone} h-3.5 w-3.5 shrink-0`}
        aria-label={row.is_self ? 'You' : 'Friend'}
        role="img"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={onUnlink}
      aria-label={`Unlink ${row.display_name} from their account`}
      title="Unlink this account — the name and tallies stay"
      className={`group/unlink hover:bg-error/10 relative grid h-5 w-5 shrink-0 place-items-center rounded transition-colors ${tone}`}
    >
      {/* Badge and cross share one slot so the row doesn't shift on hover. */}
      <Icon className="absolute h-3.5 w-3.5 transition-opacity group-hover/unlink:opacity-0" />
      <X className="text-error absolute h-3.5 w-3.5 opacity-0 transition-opacity group-hover/unlink:opacity-100" />
    </button>
  )
}
