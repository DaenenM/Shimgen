/**
 * The pure logic pulled out of pages: the draft's optimistic transitions and
 * the new-tournament request body. Both have to agree exactly with the server,
 * so they are pinned here rather than trusted to a click-through.
 */

import { describe, expect, it } from 'vitest'

import { applyPick, applyUndo } from '@/features/draft/transitions'
import { buildTournamentPayload } from '@/features/new-tournament/payload'

const draft = {
  pool: ['Cara', 'Dev', 'Eli'],
  picks_made: 0,
  picks_remaining: 3,
  current_team: 1,
  // Snake order: 1, 2, 2, 1 …
  pick_order: [1, 2, 2, 1],
  teams: [
    { id: 'a', position: 1, members: ['Ann'], is_picking: true },
    { id: 'b', position: 2, members: ['Bo'], is_picking: false },
  ],
}

describe('draft transitions', () => {
  it('moves a pick from the pool to the picking team and advances the turn', () => {
    const next = applyPick(draft, 'Dev')

    expect(next.pool).toEqual(['Cara', 'Eli'])
    expect(next.teams[0].members).toEqual(['Ann', 'Dev'])
    expect(next.picks_made).toBe(1)
    expect(next.picks_remaining).toBe(2)
    expect(next.current_team).toBe(2)
    expect(next.teams.map((t) => t.is_picking)).toEqual([false, true])
  })

  it('follows the stored order when it repeats a team', () => {
    const next = applyPick(applyPick(draft, 'Dev'), 'Cara')

    expect(next.teams[1].members).toEqual(['Bo', 'Cara'])
    expect(next.current_team).toBe(2)
  })

  it('undo is the inverse of a pick', () => {
    const picked = applyPick(draft, 'Dev')
    const undone = applyUndo(picked)

    expect(undone.pool.sort()).toEqual([...draft.pool].sort())
    expect(undone.teams.map((t) => t.members)).toEqual(draft.teams.map((t) => t.members))
    expect(undone.picks_made).toBe(0)
    expect(undone.current_team).toBe(1)
  })

  it('never undoes a captain', () => {
    expect(applyUndo(draft)).toBe(draft)
  })
})

const base = {
  title: '  Friday  ',
  format: 'single',
  mode: 'solo',
  teams: [],
  names: ['Ann', 'Bo'],
  bestOf: 3,
  thirdPlace: false,
  bracketReset: true,
  statsBoard: '',
  captains: { count: 2, mode: 'random', chosen: [] },
}

describe('buildTournamentPayload', () => {
  it('sends solo players as labels, trimmed title, best-of as the default', () => {
    expect(buildTournamentPayload(base)).toEqual({
      title: 'Friday',
      format: 'single',
      entrant_labels: ['Ann', 'Bo'],
      third_place_match: false,
      settings: { best_of: { default: 3 } },
    })
  })

  it('names unnamed teams by position', () => {
    const payload = buildTournamentPayload({
      ...base,
      mode: 'teams',
      teams: [
        { label: ' Reds ', members: ['Ann'] },
        { label: '', members: ['Bo'] },
      ],
    })

    expect(payload.entrant_teams).toEqual([
      { label: 'Reds', members: ['Ann'] },
      { label: 'Team 2', members: ['Bo'] },
    ])
    expect(payload.entrant_labels).toBeUndefined()
  })

  it('only sends bracket reset for double elimination', () => {
    expect(buildTournamentPayload(base).settings.bracket_reset).toBeUndefined()
    expect(buildTournamentPayload({ ...base, format: 'double' }).settings.bracket_reset).toBe(true)
  })

  it('opens a draft in captains mode, with captains only when chosen by hand', () => {
    const random = buildTournamentPayload({ ...base, mode: 'captains' })
    expect(random.settings.team_draft).toEqual({ team_count: 2, captain_mode: 'random' })

    const manual = buildTournamentPayload({
      ...base,
      mode: 'captains',
      captains: { count: 2, mode: 'manual', chosen: ['Ann', 'Bo'] },
    })
    expect(manual.settings.team_draft.captains).toEqual(['Ann', 'Bo'])
  })

  it('targets a board by slug, or a table when one is named', () => {
    expect(buildTournamentPayload({ ...base, statsBoard: 'abc' }).stats_board).toBe('abc')

    const table = buildTournamentPayload({ ...base, statsBoard: 'abc::42' })
    expect(table.stats_table).toBe(42)
    expect(table.stats_board).toBeUndefined()
  })
})
