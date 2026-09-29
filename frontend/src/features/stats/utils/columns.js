// Shared constants for BoardTable, BoardRow and ColumnHeader.

// The name column sorts like the others but isn't a real StatsColumn.
export const NAME_KEY = 'name'

// Colour by column role, so wins/losses/trophies stand out from a
// hand-counted column (which could mean anything).
export const ROLE_TONE = {
  tournaments_won: 'text-accent',
  won: 'text-success',
  lost: 'text-error/85',
}

export function ariaSort(key, sortKey, descending) {
  if (key !== sortKey) return 'none'
  return descending ? 'descending' : 'ascending'
}
