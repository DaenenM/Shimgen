/**
 * State that survives a reload, shared across every component using the key.
 *
 * This backs the logged-out saved roster (plan §7, v1): names typed once come
 * back as clickable chips next Saturday with no account involved. The stored
 * shape deliberately mirrors the server's Player model, so signing up is a
 * straight bulk insert with no translation layer.
 *
 * The subscription store is not incidental. Two components calling this with
 * the same key must see one value: with per-hook `useState`, a component that
 * mounted before a write holds a stale snapshot, and its next write silently
 * clobbers everything since — which is exactly how creating a tournament came
 * to wipe the roster it had just saved.
 */

import { useCallback, useSyncExternalStore } from 'react'

/** Parsed values per key, so every subscriber shares one reference. */
const cache = new Map()
/** Listener sets per key. */
const listeners = new Map()

function read(key, initialValue) {
  if (cache.has(key)) return cache.get(key)

  let value = initialValue
  try {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) value = JSON.parse(stored)
  } catch {
    // Unreadable storage or corrupt JSON. Start clean rather than crash the
    // render — a lost roster is recoverable, a white screen is not.
  }

  cache.set(key, value)
  return value
}

function write(key, value) {
  cache.set(key, value)

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or private mode: the value still works for this session.
  }

  listeners.get(key)?.forEach((listener) => listener())
}

function subscribe(key, listener) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(listener)

  // Another tab writing the same key — a host with the roster open in one tab
  // and a bracket in another would otherwise see them drift apart. The event
  // fires only in *other* tabs, so this cannot loop.
  function onStorage(event) {
    if (event.key !== key) return
    try {
      cache.set(key, event.newValue === null ? undefined : JSON.parse(event.newValue))
      listener()
    } catch {
      // Another tab wrote something unparseable; keep what we have.
    }
  }

  window.addEventListener('storage', onStorage)

  return () => {
    listeners.get(key)?.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useLocalStorage(key, initialValue) {
  const value = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => read(key, initialValue),
    // Server snapshot: there is no localStorage during SSR or prerender.
    () => initialValue,
  )

  const setValue = useCallback(
    (next) => {
      // Reads through `read` rather than closing over `value`, so an updater
      // always sees the current store even from a component that has not
      // re-rendered since the last write.
      const resolved = typeof next === 'function' ? next(read(key, initialValue)) : next
      write(key, resolved)
    },
    [key, initialValue],
  )

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing stored to remove.
    }
    cache.delete(key)
    write(key, initialValue)
  }, [key, initialValue])

  return [value, setValue, remove]
}
