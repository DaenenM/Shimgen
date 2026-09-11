/**
 * Smoke tests for the frontend scaffolding.
 *
 * Shallow on purpose: they prove the wiring holds — aliases resolve, the token
 * store round-trips, the error type behaves — so a broken setup fails here
 * rather than three files into real feature work.
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { clearTokens, getAccessToken, setTokens } from '@/api/tokens'
import { PageLoader } from '@/components/ui/PageLoader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { EditableTitle } from '@/features/bracket/EditableTitle'
import { applyResult, clearResult, scoreForClick } from '@/features/bracket/optimistic'
import { useReportQueue } from '@/features/bracket/useReportQueue'
import { RootLayout } from '@/components/layout/RootLayout'
import { AdSlot } from '@/components/ui/AdSlot'
import { AuthContext } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, TextInput } from '@/components/ui/Field'
import { SaveIndicator } from '@/features/bracket/SaveIndicator'
import { BoardTable } from '@/features/stats/BoardTable'
import { generateTeams, splitEvenly } from '@/features/teams/generate'
import { paths } from '@/routes/paths'

describe('token store', () => {
  it('round-trips a token pair', () => {
    setTokens({ access: 'a-token', refresh: 'r-token' })
    expect(getAccessToken()).toBe('a-token')

    clearTokens()
    expect(getAccessToken()).toBeNull()
  })

  it('leaves the stored refresh token alone when none is returned', () => {
    setTokens({ access: 'first', refresh: 'keep-me' })
    setTokens({ access: 'second' })

    expect(getAccessToken()).toBe('second')
    expect(localStorage.getItem('shim.refresh')).toBe('keep-me')
  })
})

describe('ApiError', () => {
  it('exposes per-field messages from the error envelope', () => {
    const error = new ApiError({
      message: 'Validation failed.',
      code: 'validation_error',
      details: { email: ['Already registered.'] },
      status: 400,
    })

    expect(error.fieldErrors('email')).toEqual(['Already registered.'])
    expect(error.fieldErrors('password')).toEqual([])
  })
})

describe('paths', () => {
  it('builds spectator links from a public slug', () => {
    expect(paths.spectate('abc123')).toBe('/t/abc123')
  })

  // A shared link carries the thing's name after its id, so a URL pasted into
  // a group chat says what it points at.
  it('appends a readable name to shareable links', () => {
    expect(paths.tournament(84, 'Friday Night')).toBe('/tournaments/84/friday-night')
    expect(paths.board('league', 'Saturday League')).toBe('/stats/league/saturday-league')
    expect(paths.spectate('abc123', 'Friday Night')).toBe('/t/abc123/friday-night')
  })

  it('omits the name when there is not a usable one', () => {
    // The id alone still resolves, so a nameless thing simply has no tail.
    expect(paths.tournament(84)).toBe('/tournaments/84')
    expect(paths.tournament(84, '')).toBe('/tournaments/84')
    expect(paths.tournament(84, '???')).toBe('/tournaments/84')
  })

  it('strips punctuation and accents rather than escaping them', () => {
    // A link full of %C3%A9 defeats the point of putting the name in it.
    expect(paths.tournament(1, 'Café Brawl!')).toBe('/tournaments/1/cafe-brawl')
    expect(paths.tournament(2, "Saturday's  Crew")).toBe('/tournaments/2/saturdays-crew')
  })

  it('caps a very long name', () => {
    const url = paths.tournament(1, 'a'.repeat(200))

    expect(url.length).toBeLessThan(80)
  })
})

describe('PageLoader', () => {
  it('announces itself to assistive technology', () => {
    render(<PageLoader label="Loading bracket…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading bracket…')
  })
})

describe('scoreForClick', () => {
  const bo1 = { id: 1, a: 10, b: 20, best_of: 1, wins_needed: 1, score: {}, winner: null }
  const bo5 = { id: 2, a: 10, b: 20, best_of: 5, wins_needed: 3, score: {}, winner: null }

  it('resolves a Bo1 on the first click', () => {
    expect(scoreForClick(bo1, 'a')).toEqual({ a: 1, b: 0 })
    expect(scoreForClick(bo1, 'b')).toEqual({ a: 0, b: 1 })
  })

  it('counts a series up one game at a time', () => {
    expect(scoreForClick({ ...bo5, score: { a: 1, b: 2 } }, 'a')).toEqual({ a: 2, b: 2 })
  })

  // The bug that prompted this: the card read the score React had rendered, so
  // two fast clicks both saw 0 and the second game never counted.
  it('counts from the score it is given, not a stale one', () => {
    const afterFirst = { ...bo5, score: { a: 1, b: 0 } }
    expect(scoreForClick(afterFirst, 'a')).toEqual({ a: 2, b: 0 })
  })

  it('hands the win over when the loser of a decided match is clicked', () => {
    const decided = { ...bo5, score: { a: 3, b: 1 }, winner: 10 }
    expect(scoreForClick(decided, 'b')).toEqual({ a: 0, b: 3 })
  })

  it('wraps past the threshold back to a clean 0-0', () => {
    const over = { ...bo5, score: { a: 3, b: 1 }, winner: 10 }
    // Clicking the winner again cycles their count, resetting the series.
    expect(scoreForClick(over, 'a')).toEqual({ a: 0, b: 0 })
  })

  it('returns null for an empty slot rather than posting a score', () => {
    expect(scoreForClick({ ...bo1, b: null }, 'b')).toBeNull()
    expect(scoreForClick(null, 'a')).toBeNull()
  })
})

describe('useReportQueue', () => {
  it('collects a run of clicks into a single flush', async () => {
    vi.useFakeTimers()
    const sent = []
    const { result } = renderHook(() =>
      useReportQueue({ delay: 15_000, onFlush: (ops) => sent.push(ops) }),
    )

    act(() => {
      result.current.enqueue({ match: 1, op: 'report', score_a: 1, score_b: 0 })
      result.current.enqueue({ match: 2, op: 'report', score_a: 1, score_b: 0 })
      result.current.enqueue({ match: 3, op: 'report', score_a: 0, score_b: 1 })
    })

    expect(sent).toHaveLength(0) // nothing sent yet
    await act(async () => vi.advanceTimersByTime(15_000))

    expect(sent).toHaveLength(1) // three clicks, one request
    expect(sent[0].map((o) => o.match)).toEqual([1, 2, 3])
    vi.useRealTimers()
  })

  it('restarts the window on each click rather than sending mid-run', async () => {
    vi.useFakeTimers()
    const sent = []
    const { result } = renderHook(() =>
      useReportQueue({ delay: 15_000, onFlush: (ops) => sent.push(ops) }),
    )

    act(() => result.current.enqueue({ match: 1, op: 'clear' }))
    await act(async () => vi.advanceTimersByTime(14_000))
    act(() => result.current.enqueue({ match: 2, op: 'clear' }))
    await act(async () => vi.advanceTimersByTime(14_000))

    expect(sent).toHaveLength(0) // still within the window
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(sent[0]).toHaveLength(2)
    vi.useRealTimers()
  })

  it('puts a failed batch back at the front, in order', async () => {
    vi.useFakeTimers()
    let attempt = 0
    const seen = []
    const onFlush = (ops) => {
      attempt += 1
      seen.push(ops.map((o) => o.match))
      if (attempt === 1) return Promise.reject(new Error('nope'))
      return Promise.resolve()
    }

    const { result } = renderHook(() =>
      useReportQueue({ delay: 1_000, onFlush, onError: () => {} }),
    )

    act(() => result.current.enqueue({ match: 1, op: 'clear' }))
    await act(async () => vi.advanceTimersByTime(1_000))

    act(() => result.current.enqueue({ match: 2, op: 'clear' }))
    await act(async () => vi.advanceTimersByTime(1_000))

    // The retry carries the failed entry first, then what followed it.
    expect(seen[1]).toEqual([1, 2])
    vi.useRealTimers()
  })

  it('flushes immediately when the tab is hidden', async () => {
    vi.useFakeTimers()
    const sent = []
    const { result } = renderHook(() =>
      useReportQueue({ delay: 15_000, onFlush: (ops) => sent.push(ops) }),
    )

    act(() => result.current.enqueue({ match: 1, op: 'clear' }))

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(sent).toHaveLength(1) // gone without waiting out the window
    vi.useRealTimers()
  })
})

describe('grand final (optimistic)', () => {
  // a = undefeated side, b = losers finalist. The decider is seated only when
  // b wins; a taking it ends the tournament.
  const build = () => [
    {
      id: 1,
      bracket: 'final',
      a: 10,
      b: 20,
      best_of: 1,
      wins_needed: 1,
      score: {},
      winner: null,
      next_match_win: 2,
      next_match_lose: null,
      position: 0,
    },
    {
      id: 2,
      bracket: 'final',
      a: null,
      b: null,
      best_of: 1,
      wins_needed: 1,
      score: {},
      winner: null,
      next_match_win: null,
      next_match_lose: null,
      position: 0,
    },
  ]

  const decider = (list) => list.find((m) => m.id === 2)

  it('seats the decider when the losers finalist wins', () => {
    const after = applyResult(build(), 1, 0, 1)
    expect(decider(after).a).toBe(10)
    expect(decider(after).b).toBe(20)
  })

  it('leaves the decider empty when the undefeated side holds', () => {
    const after = applyResult(build(), 1, 1, 0)
    expect(decider(after).a).toBeNull()
    expect(decider(after).b).toBeNull()
  })

  // The reported bug: undoing a bracket reset left one entrant behind.
  it('empties both seats when the grand final is corrected', () => {
    const seated = applyResult(build(), 1, 0, 1)
    expect(decider(seated).a).toBe(10)

    const corrected = applyResult(seated, 1, 1, 0)
    expect(decider(corrected).a).toBeNull()
    expect(decider(corrected).b).toBeNull()
  })

  it('empties both seats when the grand final is cleared', () => {
    const seated = applyResult(build(), 1, 0, 1)
    const cleared = clearResult(seated, 1)

    expect(decider(cleared).a).toBeNull()
    expect(decider(cleared).b).toBeNull()
  })
})

describe('optimistic advancement carries the name', () => {
  // The bug this pins: applyResult seated the entrant *id* but not its label,
  // and the card renders `a_label`. So the winner advanced invisibly and the
  // next round read TBD until the server answered — which looked exactly like
  // the UI waiting on the database, and was the thing optimism should prevent.
  const bracket = () => [
    {
      id: 1,
      bracket: 'main',
      round_no: 1,
      position: 0,
      a: 10,
      b: 11,
      a_label: 'Alice',
      b_label: 'Bob',
      best_of: 1,
      wins_needed: 1,
      score: {},
      winner: null,
      next_match_win: 3,
      next_match_lose: null,
    },
    {
      id: 2,
      bracket: 'main',
      round_no: 1,
      position: 1,
      a: 12,
      b: 13,
      a_label: 'Cara',
      b_label: 'Dan',
      best_of: 1,
      wins_needed: 1,
      score: {},
      winner: null,
      next_match_win: 3,
      next_match_lose: null,
    },
    {
      id: 3,
      bracket: 'main',
      round_no: 2,
      position: 0,
      a: null,
      b: null,
      a_label: null,
      b_label: null,
      best_of: 1,
      wins_needed: 1,
      score: {},
      winner: null,
      next_match_win: null,
      next_match_lose: null,
    },
  ]

  const final = (list) => list.find((m) => m.id === 3)

  it('seats the winner with their name, not just their id', () => {
    const after = applyResult(bracket(), 1, 1, 0)
    expect(final(after).a).toBe(10)
    expect(final(after).a_label).toBe('Alice')
  })

  it('carries the name for the other feeder too', () => {
    const after = applyResult(bracket(), 2, 0, 1)
    expect(final(after).b).toBe(13)
    expect(final(after).b_label).toBe('Dan')
  })

  it('takes the name away again when the result is cleared', () => {
    const seated = applyResult(bracket(), 1, 1, 0)
    expect(final(seated).a_label).toBe('Alice')

    const cleared = clearResult(seated, 1)
    expect(final(cleared).a).toBeNull()
    expect(final(cleared).a_label).toBeNull()
  })
})

describe('EditableTitle', () => {
  it('shows a plain heading when the viewer cannot edit', () => {
    render(<EditableTitle title="Saturday" canEdit={false} onSave={() => {}} />)

    expect(screen.getByText('Saturday')).toBeTruthy()
    expect(screen.queryByLabelText('Rename tournament')).toBeNull()
  })

  it('saves a new name on Enter', () => {
    const saved = []
    render(<EditableTitle title="Saturday" canEdit onSave={(t) => saved.push(t)} />)

    fireEvent.click(screen.getByLabelText('Rename tournament'))
    const input = screen.getByLabelText('Tournament name')
    fireEvent.change(input, { target: { value: 'Sunday Showdown' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(saved).toEqual(['Sunday Showdown'])
  })

  it('treats an emptied name as a cancel rather than saving a blank title', () => {
    const saved = []
    render(<EditableTitle title="Saturday" canEdit onSave={(t) => saved.push(t)} />)

    fireEvent.click(screen.getByLabelText('Rename tournament'))
    const input = screen.getByLabelText('Tournament name')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(saved).toEqual([])
  })

  it('does not fire a save when the name is unchanged', () => {
    const saved = []
    render(<EditableTitle title="Saturday" canEdit onSave={(t) => saved.push(t)} />)

    fireEvent.click(screen.getByLabelText('Rename tournament'))
    fireEvent.keyDown(screen.getByLabelText('Tournament name'), { key: 'Enter' })

    expect(saved).toEqual([])
  })

  it('discards the edit on Escape', () => {
    const saved = []
    render(<EditableTitle title="Saturday" canEdit onSave={(t) => saved.push(t)} />)

    fireEvent.click(screen.getByLabelText('Rename tournament'))
    const input = screen.getByLabelText('Tournament name')
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(saved).toEqual([])
    expect(screen.getByText('Saturday')).toBeTruthy()
  })
})

describe('generateTeams (local)', () => {
  const roster = (n) => Array.from({ length: n }, (_, i) => ({ id: i, name: `P${i}` }))
  const sizes = (teams) => teams.map((t) => t.length).sort()
  const teamOf = (teams, id) => teams.findIndex((t) => t.some((p) => p.id === id))

  it('splits everyone into the requested number of teams', () => {
    const teams = generateTeams(roster(8), 4)

    expect(teams).toHaveLength(4)
    expect(teams.flat()).toHaveLength(8)
    expect(sizes(teams)).toEqual([2, 2, 2, 2])
  })

  it('keeps team sizes even when the split is uneven', () => {
    expect(sizes(generateTeams(roster(9), 4))).toEqual([2, 2, 2, 3])
    expect(sizes(generateTeams(roster(7), 2))).toEqual([3, 4])
  })

  it('places every player exactly once', () => {
    const teams = generateTeams(roster(11), 3)
    const ids = teams.flat().map((p) => p.id)

    expect(new Set(ids).size).toBe(11)
  })

  // The rule that matters most: a broken "keep apart" is the bug a group
  // notices instantly and never forgives.
  it('honours a keep-apart rule', () => {
    for (let run = 0; run < 40; run += 1) {
      const teams = generateTeams(roster(8), 2, {
        constraints: [{ kind: 'apart', player_ids: [0, 1] }],
      })
      expect(teamOf(teams, 0)).not.toBe(teamOf(teams, 1))
    }
  })

  it('honours a keep-together rule', () => {
    for (let run = 0; run < 40; run += 1) {
      const teams = generateTeams(roster(8), 4, {
        constraints: [{ kind: 'together', player_ids: [0, 1] }],
      })
      expect(teamOf(teams, 0)).toBe(teamOf(teams, 1))
    }
  })

  it('merges overlapping together rules into one group', () => {
    // A-with-B and B-with-C means all three share a team.
    const teams = generateTeams(roster(9), 3, {
      constraints: [
        { kind: 'together', player_ids: [0, 1] },
        { kind: 'together', player_ids: [1, 2] },
      ],
    })

    expect(teamOf(teams, 0)).toBe(teamOf(teams, 1))
    expect(teamOf(teams, 1)).toBe(teamOf(teams, 2))
  })

  it('rejects a pair marked both together and apart', () => {
    expect(() =>
      generateTeams(roster(6), 2, {
        constraints: [
          { kind: 'together', player_ids: [0, 1] },
          { kind: 'apart', player_ids: [0, 1] },
        ],
      }),
    ).toThrow(/both together and apart/)
  })

  it('rejects a together group too large for any team', () => {
    expect(() =>
      generateTeams(roster(4), 2, {
        constraints: [{ kind: 'together', player_ids: [0, 1, 2] }],
      }),
    ).toThrow(/cannot fit/)
  })

  it('refuses to fill more teams than there are players', () => {
    expect(() => generateTeams(roster(3), 5)).toThrow(/cannot fill/)
  })

  it('does not hand back the arrangement it was told to avoid', () => {
    const first = generateTeams(roster(6), 2)
    const avoid = first.map((t) => t.map((p) => p.id))

    for (let run = 0; run < 20; run += 1) {
      const next = generateTeams(roster(6), 2, { avoid })
      const key = (lists) =>
        lists
          .map((t) => [...t].sort().join(','))
          .sort()
          .join(';')

      expect(key(next.map((t) => t.map((p) => p.id)))).not.toBe(key(avoid))
    }
  })

  it('splits evenly the same way the display does', () => {
    expect(splitEvenly(9, 4)).toEqual([3, 2, 2, 2])
    expect(splitEvenly(8, 2)).toEqual([4, 4])
  })
})

describe('BoardTable default sort', () => {
  const tournamentTable = {
    name: 'Season',
    // Column order as a tournament board creates them: played, won, lost,
    // then trophies last.
    columns: [
      { id: 1, name: 'Played', emoji: '🎲', role: 'played', display: 'number' },
      { id: 2, name: 'Won', emoji: '✅', role: 'won', display: 'number' },
      { id: 3, name: 'Trophies', emoji: '🏆', role: 'tournaments_won', display: 'number' },
    ],
    rows: [
      // Turns up constantly, wins a lot of games, never takes a night.
      { id: 10, display_name: 'Grinder', counts: { 1: 40, 2: 25, 3: 0 } },
      // Plays rarely but keeps winning the whole thing.
      { id: 11, display_name: 'Champion', counts: { 1: 6, 2: 4, 3: 3 } },
      { id: 12, display_name: 'Middle', counts: { 1: 20, 2: 10, 3: 1 } },
    ],
  }

  const namesInOrder = () =>
    screen
      .getAllByRole('row')
      .slice(1) // header
      .map((row) => row.querySelector('td')?.textContent?.trim())

  it('leads with trophies, not the leftmost column', () => {
    render(<BoardTable table={tournamentTable} canEdit={false} />)

    // Sorted by games played it would be Grinder, Middle, Champion.
    expect(namesInOrder()).toEqual(['Champion', 'Middle', 'Grinder'])
  })

  it('falls back to the first column when there is no trophy column', () => {
    const handCounted = {
      name: 'Tally',
      columns: [{ id: 1, name: 'Wins', emoji: '🔱', role: 'manual', display: 'emoji' }],
      rows: [
        { id: 20, display_name: 'Low', counts: { 1: 1 } },
        { id: 21, display_name: 'High', counts: { 1: 9 } },
      ],
    }

    render(<BoardTable table={handCounted} canEdit={false} />)

    expect(namesInOrder()).toEqual(['High', 'Low'])
  })
})

describe('Button', () => {
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

  it('renders a button by default', () => {
    wrap(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('renders a router link when given `to`', () => {
    wrap(<Button to="/stats">Go</Button>)

    const link = screen.getByRole('link', { name: 'Go' })
    expect(link.getAttribute('href')).toBe('/stats')
  })

  // The team generator hands squads to the bracket form through router state.
  // If the component swallowed unknown props that handoff would break silently.
  it('passes extra props through to the link', () => {
    wrap(
      <Button to="/new" state={{ squads: [] }} data-testid="handoff">
        Put these teams in a bracket
      </Button>,
    )

    expect(screen.getByTestId('handoff')).toBeTruthy()
  })

  it('applies the variant and size classes', () => {
    wrap(
      <Button variant="ghost" size="sm">
        Cancel
      </Button>,
    )

    const el = screen.getByRole('button', { name: 'Cancel' })
    expect(el.className).toContain('btn-ghost')
    expect(el.className).toContain('btn-sm')
  })

  it('falls back to a disabled button rather than an unclickable link', () => {
    wrap(
      <Button to="/stats" disabled>
        Go
      </Button>,
    )

    // A disabled anchor is not a thing the browser honours, so this must not
    // render as a link at all.
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('button', { name: 'Go' }).disabled).toBe(true)
  })

  it('disables itself while loading', () => {
    wrap(<Button loading>Create board</Button>)
    expect(screen.getByRole('button', { name: /Create board/ }).disabled).toBe(true)
  })
})

describe('useReportQueue persistence', () => {
  const KEY = 'shimgen:pending-results:195'

  it('writes unsent results to storage as they are queued', async () => {
    vi.useFakeTimers()
    localStorage.clear()

    const { result } = renderHook(() =>
      useReportQueue({ tournamentId: 195, delay: 15_000, onFlush: () => {} }),
    )

    act(() => result.current.enqueue({ match: 7, op: 'report', score_a: 1, score_b: 0 }))

    const stored = JSON.parse(localStorage.getItem(KEY))
    expect(stored).toHaveLength(1)
    expect(stored[0].match).toBe(7)
    vi.useRealTimers()
  })

  it('clears storage once the batch is sent', async () => {
    vi.useFakeTimers()
    localStorage.clear()

    const { result } = renderHook(() =>
      useReportQueue({ tournamentId: 195, delay: 1_000, onFlush: () => Promise.resolve() }),
    )

    act(() => result.current.enqueue({ match: 7, op: 'clear' }))
    expect(localStorage.getItem(KEY)).toBeTruthy()

    await act(async () => vi.advanceTimersByTime(1_000))

    expect(localStorage.getItem(KEY)).toBeNull()
    vi.useRealTimers()
  })

  it('sends what a previous session left behind', async () => {
    vi.useFakeTimers()
    localStorage.clear()
    localStorage.setItem(KEY, JSON.stringify([{ match: 3, op: 'report', score_a: 1, score_b: 0 }]))

    const sent = []
    renderHook(() =>
      useReportQueue({
        tournamentId: 195,
        delay: 15_000,
        onFlush: (ops) => {
          sent.push(ops)
          return Promise.resolve()
        },
      }),
    )

    await act(async () => vi.advanceTimersByTime(0))

    expect(sent).toHaveLength(1)
    expect(sent[0][0].match).toBe(3)
    vi.useRealTimers()
  })

  it('ignores a corrupt stored queue rather than replaying it', async () => {
    vi.useFakeTimers()
    localStorage.clear()
    localStorage.setItem(KEY, '{ not json')

    const sent = []
    renderHook(() =>
      useReportQueue({ tournamentId: 195, delay: 15_000, onFlush: (ops) => sent.push(ops) }),
    )

    await act(async () => vi.advanceTimersByTime(0))

    expect(sent).toHaveLength(0)
    vi.useRealTimers()
  })

  // A batch the server refuses on its merits must not be retried forever: with
  // the queue persisted it would knock the bracket back on every visit.
  it('drops a permanently rejected batch instead of keeping it', async () => {
    vi.useFakeTimers()
    localStorage.clear()

    const rejection = Object.assign(new Error('Both entrants must be decided'), { status: 400 })
    const { result } = renderHook(() =>
      useReportQueue({
        tournamentId: 195,
        delay: 1_000,
        onFlush: () => Promise.reject(rejection),
        onError: () => {},
      }),
    )

    act(() => result.current.enqueue({ match: 9, op: 'report', score_a: 1, score_b: 1 }))
    await act(async () => vi.advanceTimersByTime(1_000))

    expect(localStorage.getItem(KEY)).toBeNull()
    vi.useRealTimers()
  })

  it('keeps a batch that failed for a reason a retry could fix', async () => {
    vi.useFakeTimers()
    localStorage.clear()

    const offline = Object.assign(new Error('Network Error'), { status: undefined })
    const { result } = renderHook(() =>
      useReportQueue({
        tournamentId: 195,
        delay: 1_000,
        onFlush: () => Promise.reject(offline),
        onError: () => {},
      }),
    )

    act(() => result.current.enqueue({ match: 9, op: 'clear' }))
    await act(async () => vi.advanceTimersByTime(1_000))

    expect(JSON.parse(localStorage.getItem(KEY))).toHaveLength(1)
    vi.useRealTimers()
  })
})

describe('SaveIndicator', () => {
  it('shows nothing before anything has been reported', () => {
    const { container } = render(<SaveIndicator state="idle" />)
    expect(container.firstChild).toBeNull()
  })

  it('reads as saving while results are queued', () => {
    render(<SaveIndicator state="saving" />)
    expect(screen.getByRole('status').textContent).toContain('Saving')
  })

  it('keeps a saved confirmation on the page', () => {
    render(<SaveIndicator state="saved" />)

    const el = screen.getByRole('status')
    expect(el.textContent).toContain('Saved')
    // Green rather than neutral: the confirmation is the whole point.
    expect(el.className).toContain('success')
  })

  // Both marks stay mounted so the swap can cross-fade without the row
  // jumping as one element's box gives way to the other's.
  it('keeps both the spinner and the tick mounted in each state', () => {
    const { container: saving } = render(<SaveIndicator state="saving" />)
    expect(saving.querySelector('.loading-spinner')).toBeTruthy()
    expect(saving.querySelector('svg')).toBeTruthy()

    const { container: saved } = render(<SaveIndicator state="saved" />)
    expect(saved.querySelector('.loading-spinner')).toBeTruthy()
    expect(saved.querySelector('svg')).toBeTruthy()
  })
})

describe('SectionLoader', () => {
  it('announces itself to assistive technology', () => {
    render(<SectionLoader label="Loading your boards…" />)

    const el = screen.getByRole('status')
    expect(el.textContent).toContain('Loading your boards…')
    expect(el.getAttribute('aria-live')).toBe('polite')
  })

  it('reserves height so the page does not jump when rows arrive', () => {
    const { container } = render(<SectionLoader />)
    expect(container.firstChild.className).toContain('min-h-')
  })
})

describe('AdSlot', () => {
  it('reserves the space an ad will occupy', () => {
    const { container } = render(<AdSlot placement="sidebar" />)
    // A fixed height is the whole point: the ad must not push content down.
    expect(container.querySelector('[class*="h-["]')).toBeTruthy()
  })

  it('renders the ad markup it is given', () => {
    render(
      <AdSlot placement="footer">
        <div data-testid="ad-unit" />
      </AdSlot>,
    )
    expect(screen.getByTestId('ad-unit')).toBeTruthy()
  })

  it('labels itself for assistive technology', () => {
    render(<AdSlot placement="footer" />)
    expect(screen.getByRole('complementary').getAttribute('aria-label')).toBe('Advertisement')
  })
})

describe('Card', () => {
  it('does not look interactive unless it is', () => {
    const { container: plain } = render(<Card>flat</Card>)
    expect(plain.firstChild.className).not.toContain('hover:shadow')

    const { container: live } = render(<Card interactive>clickable</Card>)
    expect(live.firstChild.className).toContain('hover:shadow')
  })
})

describe('Field', () => {
  it('associates the label with its control', () => {
    render(
      <Field label="Board name">
        <TextInput />
      </Field>,
    )
    // Wrapping label: focusing by the label text must reach the input.
    expect(screen.getByLabelText('Board name')).toBeTruthy()
  })

  it('shows an error in place of the hint', () => {
    render(
      <Field label="Name" hint="Optional" error="Required">
        <TextInput />
      </Field>,
    )
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.queryByText('Optional')).toBeNull()
  })
})

describe('layout navigation', () => {
  const signedOut = {
    user: null,
    status: 'idle',
    isAuthenticated: false,
    isLoading: false,
    login: () => {},
    loginWithGoogle: () => {},
    register: () => {},
    logout: () => {},
  }

  // A *data* router: RootLayout calls useDocumentTitle, which reads useMatches
  // and only works under createMemoryRouter / createBrowserRouter.
  const mount = () => {
    const router = createMemoryRouter(
      [{ element: <RootLayout />, children: [{ index: true, element: <div>page</div> }] }],
      { initialEntries: ['/'] },
    )

    return render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={signedOut}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
  }

  // This caught a real regression: the Navbar import survived a layout rewrite
  // but the element did not, so desktop lost its navigation entirely and lint
  // saw nothing wrong.
  it('keeps the desktop navbar in the layout', () => {
    mount()
    expect(screen.getAllByText('Team Generator').length).toBeGreaterThan(0)
  })

  it('renders the mobile tab bar too', () => {
    mount()
    // Both navigations exist in the DOM; CSS decides which one is visible.
    expect(screen.getByLabelText('Account menu')).toBeTruthy()
  })

  it('reserves room for the fixed tab bar so pages are not cut off', () => {
    const { container } = mount()
    const main = container.querySelector('main')

    expect(main.className).toContain('pb-[calc(4rem+env(safe-area-inset-bottom))]')
    expect(main.className).toContain('lg:pb-0')
  })
})
