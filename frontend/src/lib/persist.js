// Caches tournaments and boards to localStorage so returning visitors see
// data instantly instead of a spinner, before the network refetch lands.
// Used by App.jsx to configure react-query's persistence.

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const PERSIST_KEY = 'shimgen:query-cache'

// Bump this when a cached shape would no longer match what the app expects,
// so old caches get discarded instead of rendering undefined fields.
const CACHE_BUSTER = 'v1'

// How long a cache is trusted before it's ignored (a week).
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

// Only these are safe to keep on disk. Everything else (profile, friends,
// searches) is personal and must not survive in localStorage.
const PERSISTED_PREFIXES = ['tournaments', 'boards']

export function shouldPersist(query) {
  if (query.state.status !== 'success') return false

  const [root] = query.queryKey
  return PERSISTED_PREFIXES.includes(root)
}

const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: PERSIST_KEY,
  throttleTime: 1000, // batch writes instead of one per mutation
  retry: undefined, // storage can be full or disabled; fail silently
})

export const persistOptions = {
  persister,
  maxAge: MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
}

// Called on logout so the next person on a shared device doesn't see the
// previous user's tournaments painted from disk before any request runs.
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(PERSIST_KEY)
  } catch {
    // nothing stored, or storage unavailable
  }
}
