/**
 * The pure logic pulled out of pages: the draft's optimistic transitions and
 * the new-tournament request body. Both have to agree exactly with the server,
 * so they are pinned here rather than trusted to a click-through.
 */

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { applyPick, applyUndo } from '@/features/draft/utils/transitions'
import { bestOfLabel } from '@/features/bracket/utils/layout'
import { standingsFor } from '@/features/bracket/utils/standings'
import { suggestGames } from '@/features/new-tournament/utils/games'
import { buildTournamentPayload } from '@/features/new-tournament/utils/payload'
import { optimistic, patchById, removeById, toggleFavourite } from '@/lib/optimistic'

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

describe('suggestGames', () => {
  const games = [
    { name: 'League of Legends', aliases: ['lol', 'league'] },
    { name: 'Counter-Strike 2', aliases: ['cs', 'cs2', 'csgo'] },
    { name: 'Beer Pong', aliases: ['beerpong', 'pong'] },
    { name: 'Ping Pong', aliases: ['table tennis'] },
  ]

  it('puts a nickname match first', () => {
    expect(suggestGames(games, 'LoL')[0]).toBe('League of Legends')
    expect(suggestGames(games, 'cs:go')).toEqual(['Counter-Strike 2'])
  })

  it('matches name prefixes and words inside names', () => {
    expect(suggestGames(games, 'beer')).toEqual(['Beer Pong'])
    expect(suggestGames(games, 'pong')).toEqual(['Beer Pong', 'Ping Pong'])
  })

  it('hides once the exact name is typed, and for empty text', () => {
    expect(suggestGames(games, 'beer pong')).toEqual([])
    expect(suggestGames(games, '  ')).toEqual([])
  })
})

describe('buildTournamentPayload game', () => {
  const form = {
    title: '',
    format: 'single',
    mode: 'solo',
    teams: [],
    names: ['Ann', 'Bo'],
    bestOf: 1,
    thirdPlace: false,
    bracketReset: false,
    statsBoard: '',
    captains: { count: 2, mode: 'random', chosen: [] },
  }

  it('sends a trimmed game name only when one is typed', () => {
    expect(buildTournamentPayload({ ...form, game: ' LoL ' }).game_name).toBe('LoL')
    expect(buildTournamentPayload({ ...form, game: '  ' })).not.toHaveProperty('game_name')
  })
})

describe('standingsFor', () => {
  const m = (id, extra) => ({
    id,
    bracket: 'main',
    round_no: 1,
    position: 0,
    a: null,
    b: null,
    winner: null,
    score: {},
    next_match_win: null,
    ...extra,
  })
  const entrants = [1, 2, 3, 4].map((id) => ({ id, label: `E${id}` }))

  it('places a finished knockout: champion, runner-up, joint semifinalists', () => {
    const matches = [
      m(1, { a: 1, b: 2, winner: 1, position: 0, next_match_win: 3 }),
      m(2, { a: 3, b: 4, winner: 3, position: 1, next_match_win: 3 }),
      m(3, { round_no: 2, a: 1, b: 3, winner: 3 }),
    ]
    const rows = standingsFor({ format: 'single', entrants, matches })
    expect(rows.map((r) => [r.label, r.placement])).toEqual([
      ['E3', 1],
      ['E1', 2],
      ['E2', 3],
      ['E4', 3],
    ])
  })

  it('ranks the mid-tournament leader 1st, not 2nd', () => {
    const matches = [
      m(1, { a: 1, b: 2, winner: 1, next_match_win: 3 }),
      m(2, { a: 3, b: 4, position: 1, next_match_win: 3 }),
      m(3, { round_no: 2, a: 1 }),
    ]
    const rows = standingsFor({ format: 'single', entrants, matches })
    expect(rows.find((r) => r.label === 'E1').placement).toBe(1)
    // E1 is alone in the final; E3/E4 are level and still alive, so they share 2nd.
    expect(rows.filter((r) => r.placement === 1).map((r) => r.label)).toEqual(['E1'])
    expect(rows.filter((r) => r.placement === 2).map((r) => r.label)).toEqual(['E3', 'E4'])
  })

  it('orders a points table by points, then strength of schedule', () => {
    const matches = [
      m(1, { a: 1, b: 2, winner: 2 }),
      m(2, { a: 1, b: 3, winner: 1 }),
      m(3, { a: 2, b: 4, winner: 4 }),
    ]
    const rows = standingsFor({ format: 'rr', entrants, matches, settings: {} })
    expect(rows[0]).toMatchObject({ label: 'E2', points: 3, wins: 1, losses: 1 })
    expect(rows.map((r) => r.label).slice(0, 3)).toEqual(['E2', 'E1', 'E4'])
  })
})

describe('optimistic helpers', () => {
  it('edits bare and paginated lists alike', () => {
    expect(removeById([{ id: 1 }, { id: 2 }], 1)).toEqual([{ id: 2 }])
    expect(patchById({ results: [{ id: 1, a: 0 }] }, 1, { a: 5 })).toEqual({
      results: [{ id: 1, a: 5 }],
    })
    expect(removeById({ id: 1, title: 'detail' }, 1)).toEqual({ id: 1, title: 'detail' })
  })

  it('pins a favourite to the top and unpins it back into date order', () => {
    const list = [
      { id: 1, favourited_at: null, created_at: '2026-01-03' },
      { id: 2, favourited_at: null, created_at: '2026-01-02' },
    ]
    const pinned = toggleFavourite(list, 2)
    expect(pinned.map((t) => t.id)).toEqual([2, 1])
    expect(toggleFavourite(pinned, 2).map((t) => t.id)).toEqual([1, 2])
  })

  it('rolls the cache back when the request fails', async () => {
    const client = new QueryClient()
    const key = ['things']
    client.setQueryData(key, [{ id: 1 }, { id: 2 }])

    const handlers = optimistic(client, key, removeById, { refetch: false })
    const context = await handlers.onMutate(1)
    expect(client.getQueryData(key)).toEqual([{ id: 2 }])

    handlers.onError(new Error('nope'), 1, context)
    expect(client.getQueryData(key)).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe('bestOfLabel', () => {
  it('names the series length, a range when rounds differ, nothing for Bo1', () => {
    expect(bestOfLabel([{ best_of: 3 }, { best_of: 3 }])).toBe('Best of 3')
    expect(bestOfLabel([{ best_of: 1 }, { best_of: 3 }, { best_of: 5 }])).toBe('Best of 1–5')
    expect(bestOfLabel([{ best_of: 1 }])).toBeNull()
    expect(bestOfLabel([])).toBeNull()
  })
})
