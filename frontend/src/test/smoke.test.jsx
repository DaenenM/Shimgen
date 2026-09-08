/**
 * Smoke tests for the frontend scaffolding.
 *
 * Shallow on purpose: they prove the wiring holds — aliases resolve, the token
 * store round-trips, the error type behaves — so a broken setup fails here
 * rather than three files into real feature work.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import { clearTokens, getAccessToken, setTokens } from '@/api/tokens'
import { PageLoader } from '@/components/ui/PageLoader'
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
