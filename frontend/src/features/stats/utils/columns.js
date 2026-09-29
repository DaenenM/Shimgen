// The name column sorts like the others but has no StatsColumn behind it, so it
// needs a key that cannot collide with a real column id.
export const NAME_KEY = 'name'

/**
 * What each kind of column is worth, as colour.
 *
 * Every number on this board used to be body text, so "games played", "won",
 * "lost" and "tournaments won" were four columns of identical white digits and
 * telling a good line from a bad one meant reading the headers each time.
 *
 * Only the columns that carry a verdict get a hue. Games played is a volume,
 * not a result, and a hand-counted column means whatever its crew decided it
 * means — colouring either would be asserting something the data does not say.
 */
export const ROLE_TONE = {
  tournaments_won: 'text-accent',
  won: 'text-success',
  lost: 'text-error/85',
}

/** The `aria-sort` value for a header, given the table's current sort. */
export function ariaSort(key, sortKey, descending) {
  if (key !== sortKey) return 'none'
  return descending ? 'descending' : 'ascending'
}
