/**
 * React Query configuration.
 *
 * Defaults are tuned for the app's actual shape: a bracket left open on a second
 * monitor for hours, and a roster that changes rarely.
 */

import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Two minutes of freshness. Anything that changes because of something
      // the user did invalidates its own query directly, so a shorter window
      // only bought refetches on every navigation — and a spinner with it.
      staleTime: 2 * 60_000,
      // Kept an hour rather than five minutes: coming back to a page you were
      // just on should paint from cache, not reload. The data is small.
      gcTime: 60 * 60_000,

      // Cached data renders immediately while a refetch happens behind it, so
      // returning to a page shows the page rather than a loading state.
      placeholderData: (previous) => previous,

      // Refetch when a tab regains focus — the second-monitor case, where the
      // page may have been idle for an hour.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Stale data refetches on mount, fresh data does not. `false` was too
      // aggressive: it also ignored explicit invalidations, so a newly created
      // tournament stayed missing from its list — the cache had been marked
      // stale but nothing ever acted on it. With placeholderData above, the
      // refetch is invisible anyway: the cached page paints immediately and
      // updates underneath.
      refetchOnMount: true,

      retry: (failureCount, error) => {
        // 4xx means the request itself was wrong: unauthenticated, forbidden,
        // not found, invalid. Retrying just repeats the same failure. 401 in
        // particular is already handled by the client's refresh interceptor.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      // A mutation is a user action — reporting a result, adding an entrant.
      // Silently retrying could double-apply it, so failures surface instead.
      retry: false,
    },
  },
})

/**
 * Query keys in one place.
 *
 * Every key is built from these factories, so invalidating after a mutation
 * cannot miss a cache entry because a key was spelled differently at the call
 * site. The hierarchy means `queryKeys.tournaments.all` invalidates every
 * tournament query at once.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'],
    // Keyed by term so each query caches separately — backspacing to something
    // already typed comes back from cache rather than over the network.
    search: (term) => ['auth', 'search', term],
  },
  tournaments: {
    all: ['tournaments'],
    detail: (slug) => ['tournaments', slug],
    matches: (slug) => ['tournaments', slug, 'matches'],
    standings: (slug) => ['tournaments', slug, 'standings'],
  },
  roster: {
    all: ['roster'],
  },
  friends: {
    all: ['friends'],
    accepted: ['friends', 'accepted'],
    pending: ['friends', 'pending'],
    sent: ['friends', 'sent'],
  },
  boards: {
    all: ['boards'],
    detail: (slug) => ['boards', slug],
  },
}
