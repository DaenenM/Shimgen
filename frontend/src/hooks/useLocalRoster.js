/**
 * The saved roster for someone with no account.
 *
 * Plan §7 moves this into v1 deliberately: it is an afternoon of work backed by
 * localStorage, needs no accounts, and is the feature most likely to make
 * someone use the site a second time. Re-typing ten names every Saturday is
 * exactly the friction that sends people back to a random generator.
 *
 * The stored shape mirrors the server's Player model, so signing up is a
 * straight bulk insert with no translation layer.
 */

import { useCallback, useMemo } from 'react'

import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'shim.roster'

// Module-level constant, not a fresh [] per render: useSyncExternalStore
// compares snapshots by identity, and a new array each time would loop.
const EMPTY = []

export function useLocalRoster() {
  const [players, setPlayers, clear] = useLocalStorage(STORAGE_KEY, EMPTY)

  const add = useCallback(
    (name) => {
      const display_name = name.trim()
      if (!display_name) return

      setPlayers((current) => {
        // Case-insensitive de-duplication: "Brett" and "brett" are one person,
        // and a roster with both in it is just noise.
        if (current.some((p) => p.display_name.toLowerCase() === display_name.toLowerCase())) {
          return current
        }
        return [...current, { display_name, last_used_at: null }]
      })
    },
    [setPlayers],
  )

  const addMany = useCallback(
    (names) => {
      setPlayers((current) => {
        const seen = new Set(current.map((p) => p.display_name.toLowerCase()))
        const additions = []

        for (const raw of names) {
          const display_name = raw.trim()
          const key = display_name.toLowerCase()
          if (!display_name || seen.has(key)) continue
          seen.add(key)
          additions.push({ display_name, last_used_at: null })
        }

        return [...current, ...additions]
      })
    },
    [setPlayers],
  )

  const remove = useCallback(
    (name) => {
      setPlayers((current) => current.filter((p) => p.display_name !== name))
    },
    [setPlayers],
  )

  /** Stamp everyone used in an event, so the picker orders by recency. */
  const touch = useCallback(
    (names) => {
      const used = new Set(names.map((n) => n.toLowerCase()))
      const now = new Date().toISOString()

      setPlayers((current) =>
        current.map((p) =>
          used.has(p.display_name.toLowerCase()) ? { ...p, last_used_at: now } : p,
        ),
      )
    },
    [setPlayers],
  )

  // Most recently played first, never-played last, alphabetical within each.
  const sorted = useMemo(
    () =>
      [...players].sort((a, b) => {
        if (a.last_used_at && b.last_used_at) {
          return b.last_used_at.localeCompare(a.last_used_at)
        }
        if (a.last_used_at) return -1
        if (b.last_used_at) return 1
        return a.display_name.localeCompare(b.display_name)
      }),
    [players],
  )

  return { players: sorted, add, addMany, remove, touch, clear }
}
