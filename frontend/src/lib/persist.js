/**
 * Keeping tournaments and stats boards on the device between visits.
 *
 * Opening the app used to mean a spinner while the list was fetched, every
 * time, even though the answer was almost always the same as last time. The
 * cache is written to localStorage and restored before the first render, so the
 * page paints with last visit's data immediately and the network response
 * replaces it underneath. With nothing stored — a first visit, a cleared
 * browser — the queries start empty and the existing loading states show, which
 * is the same behaviour as before.
 *
 * This is cosmetic in the sense that it changes no data, and load-bearing in
 * the sense that it decides what a returning visitor sees in the first 200ms.
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/** Namespaced like the app's other stored values (see `useReportQueue`). */
export const PERSIST_KEY = 'shimgen:query-cache'

/**
 * Bumped when a cached shape stops being readable by this build.
 *
 * Restoring a payload whose fields have since been renamed is worse than
 * fetching afresh: the page renders undefined where it expects a value. The
 * library discards everything under a non-matching buster, so changing this is
 * the escape hatch for a serializer change that lands mid-week.
 */
export const CACHE_BUSTER = 'v1'

/**
 * A week. Long enough that a fortnightly game night still opens warm, short
 * enough that a genuinely abandoned cache is not restored indefinitely.
 *
 * This is an outer bound on restoration, not a freshness window — `staleTime`
 * still governs refetching, so restored data is refetched on mount regardless.
 */
export const MAX_AGE = 7 * 24 * 60 * 60 * 1000

/**
 * Only tournaments and boards are written to disk.
 *
 * The cache also holds `auth.me`, friend lists and handle searches — a
 * person's profile, their email, and the people they play with. None of that
 * belongs in localStorage, where it survives the tab and is readable by any
 * script that gets a foothold on the origin. An allowlist rather than a
 * denylist, so a query added later is private by default and has to be opted
 * in deliberately.
 *
 * Both prefixes cover their nested keys: `['boards']` catches
 * `boards.detail(slug)`, and `['tournaments']` catches the `{archived: true}`
 * variant and a bracket's own detail key.
 */
const PERSISTED_PREFIXES = ['tournaments', 'boards']

/**
 * Never store a failed or still-running query.
 *
 * A rejected query restored from disk comes back as an error state with no
 * request behind it, so the page renders its error branch on open and stays
 * there until something triggers a refetch — a broken page built from a
 * problem that has very likely already passed.
 */
export function shouldPersist(query) {
  if (query.state.status !== 'success') return false

  const [root] = query.queryKey
  return PERSISTED_PREFIXES.includes(root)
}

export const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: PERSIST_KEY,
  /**
   * Writes are batched rather than made per change. A host clicking through a
   * round mutates the cache repeatedly, and serialising the whole thing on
   * every keystroke-sized update is real main-thread work on a phone.
   */
  throttleTime: 1000,
  /**
   * Storage can be full, or disabled entirely in private mode. A cache that
   * cannot be written is a missing optimisation, never a broken app, so the
   * failure is swallowed here rather than thrown into render.
   */
  retry: undefined,
})

export const persistOptions = {
  persister,
  maxAge: MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
}

/**
 * Forget everything on this device.
 *
 * Called on logout. Without it the persisted cache outlives the session: the
 * next person to open the app on a shared machine sees the previous user's
 * tournaments and boards painted from disk before any request is made, and no
 * amount of server-side auth prevents that, because nothing is being asked.
 */
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(PERSIST_KEY)
  } catch {
    // Nothing stored, or storage is unavailable. Either way there is nothing
    // left behind to worry about.
  }
}
