import { User, Users, X } from '@/components/icons'

/**
 * Marks a row that belongs to a real account.
 *
 * Same pairing the roster uses: amber for your own account, blue for a
 * friend's. A row with neither is a plain name somebody typed.
 *
 * In edit mode the badge is the unlink control, because the icon is already
 * the thing that says "this row is a person" — clicking it to stop being that
 * person is the gesture people reach for. The label and the tallies stay; only
 * the account link goes.
 */
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
      {/* The badge at rest, a cross on hover — one slot, so the row does not
          shift as they swap. */}
      <Icon className="absolute h-3.5 w-3.5 transition-opacity group-hover/unlink:opacity-0" />
      <X className="text-error absolute h-3.5 w-3.5 opacity-0 transition-opacity group-hover/unlink:opacity-100" />
    </button>
  )
}
