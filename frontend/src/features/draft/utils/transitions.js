/**
 * A draft's state after one pick or one undo, computed locally.
 *
 * Applied exactly as the server applies them — name out of the pool, onto the
 * picking team, turn advanced — so the optimistic view and the confirmed one
 * agree. Anything less and the screen would flicker as the response corrected
 * it.
 */

export function applyPick(draft, label) {
  const position = draft.current_team
  const picksMade = draft.picks_made + 1
  // Read from the stored rotation rather than guessed: the order is not a
  // simple increment once it wraps, and the server is the one that decided it.
  const next = draft.pick_order?.[picksMade] ?? null

  return {
    ...draft,
    pool: draft.pool.filter((name) => name !== label),
    picks_made: picksMade,
    picks_remaining: Math.max(0, draft.picks_remaining - 1),
    current_team: next,
    teams: draft.teams.map((team) => ({
      ...team,
      members: team.position === position ? [...team.members, label] : team.members,
      is_picking: team.position === next,
    })),
  }
}

export function applyUndo(draft) {
  if (draft.picks_made === 0) return draft

  const picksMade = draft.picks_made - 1
  // Whose pick is being taken back — the turn *before* the current one.
  const position = draft.pick_order?.[picksMade] ?? null
  const undone = draft.teams.find((team) => team.position === position)
  // The captain leads `members` and is not a pick, so the last entry is the
  // only thing an undo can remove.
  const restored = undone?.members?.[undone.members.length - 1]

  return {
    ...draft,
    pool: restored ? [...draft.pool, restored] : draft.pool,
    picks_made: picksMade,
    picks_remaining: draft.picks_remaining + 1,
    current_team: position,
    teams: draft.teams.map((team) => ({
      ...team,
      members:
        team.position === position && team.members.length > 1
          ? team.members.slice(0, -1)
          : team.members,
      is_picking: team.position === position,
    })),
  }
}
