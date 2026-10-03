// Optimistic mutations: patch cached data on click, roll back if the server refuses, then re-sync.
// Used by the feature hooks (friends, roster, saved teams, boards, tournaments).

/**
 * Mutation options that run `edit(data, variables, queryKey, prepared)` on every cached query under `key`.
 * `prepare(variables)` runs first, before any edit, for lookups that edits would disturb.
 */
export function optimistic(queryClient, key, edit, { prepare, refetch = true } = {}) {
  return {
    onMutate: async (variables) => {
      // Awaited so an in-flight refetch can't land on top of the edit.
      await queryClient.cancelQueries({ queryKey: key })

      const snapshot = queryClient.getQueriesData({ queryKey: key })
      const prepared = prepare?.(variables)

      for (const [queryKey, data] of snapshot) {
        if (data !== undefined) {
          queryClient.setQueryData(queryKey, edit(data, variables, queryKey, prepared))
        }
      }
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      context?.snapshot?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
    },
    // The edit only bridges the wait; the server's copy wins once it answers.
    onSettled: () => (refetch ? queryClient.invalidateQueries({ queryKey: key }) : undefined),
  }
}

/** Run `fn` on a cached list, bare array or paginated `{ results }`; anything else passes through. */
export function editList(data, fn) {
  if (Array.isArray(data)) return fn(data)
  if (Array.isArray(data?.results)) return { ...data, results: fn(data.results) }
  return data
}

export const removeById = (data, id) => editList(data, (list) => list.filter((x) => x.id !== id))

/** Merge `patch` (object, or function of the item) into the list item with `id`. */
export const patchById = (data, id, patch) =>
  editList(data, (list) =>
    list.map((x) =>
      x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x,
    ),
  )

export const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Flip `favourited_at` and re-sort like the server: favourites first (oldest pin first), then newest. */
export const toggleFavourite = (data, id) =>
  editList(data, (list) =>
    list
      .map((x) =>
        x.id === id || x.slug === id
          ? { ...x, favourited_at: x.favourited_at ? null : new Date().toISOString() }
          : x,
      )
      .sort((x, y) => {
        if (x.favourited_at && y.favourited_at)
          return x.favourited_at.localeCompare(y.favourited_at)
        if (x.favourited_at || y.favourited_at) return x.favourited_at ? -1 : 1
        return (y.created_at ?? '').localeCompare(x.created_at ?? '')
      }),
  )
