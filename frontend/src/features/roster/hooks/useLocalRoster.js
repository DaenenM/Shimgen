// Saved roster for a signed-out visitor, backed by localStorage (plan §7).
// Used by useRoster.js, useRegisterForm.js.
// Stored shape mirrors the server's Player model so signup can bulk-insert it directly.

import { useCallback, useMemo } from 'react'

import { useLocalStorage } from '@/hooks/useLocalStorage'

const STORAGE_KEY = 'shim.roster'

// Module-level, not a fresh [] per render — useSyncExternalStore compares by identity.
const EMPTY = []

export function useLocalRoster() {
  const [players, setPlayers, clear] = useLocalStorage(STORAGE_KEY, EMPTY)

  const add = useCallback(
    (name) => {
      const display_name = name.trim()
      if (!display_name) return

      setPlayers((current) => {
        // Case-insensitive de-dup: "Brett" and "brett" are the same person.
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

  // Stamps everyone used in an event, so the picker orders by recency.
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

  // Most recently played first, never-played last, alphabetical within each group.
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
