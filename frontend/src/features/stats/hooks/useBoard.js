import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { boards as boardsApi, friends as friendsApi } from '@/api/endpoints'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { optimistic } from '@/lib/optimistic'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

// Loads one stats board and exposes every mutation on it as a plain function.
// Used by BoardPage.jsx and StatsBoardField.jsx.
export function useBoard(slug) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const key = queryKeys.boards.detail(slug)

  // Which tally cell is waiting on the server, so it can show it.
  const [busyKey, setBusyKey] = useState(null)

  const { data: board, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => boardsApi.get(slug),
    // Always refetch on arrival since other users can update tallies live.
    staleTime: 0,
  })

  // Sharing is limited to friends, same rule as bracket co-hosting.
  const { data: friendships } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
  })

  // Friendship is stored directionally; "them" is whichever side isn't the request sender.
  const friends = (friendships ?? [])
    .map((item) => (item.direction === 'outgoing' ? item.to_user : item.from_user))
    .filter(Boolean)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  // Rewrites a bare-slug URL to the named form so the address bar matches the Share link.
  const canonical = board ? paths.board(board.slug, board.name) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  // Debounced so a burst of tally clicks doesn't refetch after every tap.
  const reconcile = useDebouncedCallback(refresh, 400)

  // Award/remove a mark optimistically so it appears instantly, then reconciles with the server.
  const award = useMutation({
    mutationFn: ({ row, column, delta }) => boardsApi.award(slug, row, column, delta),
    onMutate: ({ row, column, delta }) => {
      // Cache write is synchronous; cancelQueries isn't awaited so taps don't wait on it.
      const previous = queryClient.getQueryData(key)
      if (previous) queryClient.setQueryData(key, withTally(previous, row, column, delta))

      queryClient.cancelQueries({ queryKey: key })

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      setBusyKey(null)
      reconcile()
    },
  })

  // Adds need server ids, so they wait for the response and refetch.
  const change = (mutationFn, options = {}) => ({ mutationFn, onSuccess: refresh, ...options })
  // Edits/removals patch the cached board on click, then refetch.
  const edit = (mutationFn, patch) => ({
    mutationFn,
    ...optimistic(queryClient, key, (b, vars) => (b?.tables ? patch(b, vars) : b)),
  })

  // Slug stays stable across a rename, so existing links keep working.
  const renameBoard = useMutation(
    edit(
      (name) => boardsApi.update(slug, { name }),
      (b, name) => ({ ...b, name }),
    ),
  )
  const addTable = useMutation(change((payload) => boardsApi.addTable(slug, payload)))
  const renameTable = useMutation(
    edit(
      ({ id, name }) => boardsApi.updateTable(id, { name }),
      (b, { id, name }) => withTables(b, (t) => (t.id === id ? { ...t, name } : t)),
    ),
  )
  const removeTable = useMutation(
    edit(
      (id) => boardsApi.removeTable(id),
      (b, id) => ({ ...b, tables: b.tables.filter((t) => t.id !== id) }),
    ),
  )

  // Two PATCHes sent together; the cache swaps both positions at once.
  const moveTable = useMutation(
    edit(
      ({ a, b }) =>
        Promise.all([
          boardsApi.updateTable(a.id, { position: b.position }),
          boardsApi.updateTable(b.id, { position: a.position }),
        ]),
      (board, { a, b }) => ({
        ...board,
        tables: board.tables
          .map((t) => (t.id === a.id ? { ...t, position: b.position } : t))
          .map((t) => (t.id === b.id ? { ...t, position: a.position } : t))
          .sort((x, y) => x.position - y.position || x.id - y.id),
      }),
    ),
  )

  const addColumn = useMutation(
    change(({ tableId, ...payload }) => boardsApi.addColumn(tableId, payload)),
  )
  const updateColumn = useMutation(
    edit(
      ({ id, ...payload }) => boardsApi.updateColumn(id, payload),
      (b, { id, ...payload }) =>
        withTables(b, (t) => ({
          ...t,
          columns: t.columns.map((c) => (c.id === id ? { ...c, ...payload } : c)),
        })),
    ),
  )
  const removeColumn = useMutation(
    edit(
      (id) => boardsApi.removeColumn(id),
      (b, id) => withTables(b, (t) => ({ ...t, columns: t.columns.filter((c) => c.id !== id) })),
    ),
  )

  const addRows = useMutation(
    change(({ tableId, ...payload }) => boardsApi.addRows(tableId, payload)),
  )
  const removeRow = useMutation(
    edit(
      (id) => boardsApi.removeRow(id),
      (b, id) => withTables(b, (t) => ({ ...t, rows: t.rows.filter((r) => r.id !== id) })),
    ),
  )
  // Rename/swap/unlink keep tallies. Label shows at once; a new player link arrives with the refetch.
  const updateRow = useMutation(
    edit(
      ({ id, ...payload }) => boardsApi.updateRow(id, payload),
      (b, { id, label }) =>
        label === undefined
          ? b
          : withTables(b, (t) => ({
              ...t,
              rows: t.rows.map((r) => (r.id === id ? { ...r, label } : r)),
            })),
    ),
  )

  const addPerson = useMutation(
    change((userId) => boardsApi.addPerson(slug, userId), { meta: { errorShown: true } }),
  )
  const removePerson = useMutation(
    edit(
      (userId) => boardsApi.removePerson(slug, userId),
      (b, userId) => ({ ...b, people: (b.people ?? []).filter((p) => p.user !== userId) }),
    ),
  )

  const removeBoard = useMutation({
    mutationFn: () => boardsApi.remove(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
      navigate(paths.stats)
    },
  })

  const actions = {
    award: (row, column, delta) => {
      setBusyKey(`${row}:${column}`)
      award.mutate({ row, column, delta })
    },
    renameBoard: (name) => renameBoard.mutate(name),
    removeBoard: () => removeBoard.mutate(),
    addTable: (payload) => addTable.mutate(payload),
    renameTable: (id, name) => renameTable.mutate({ id, name }),
    removeTable: (id) => removeTable.mutate(id),
    moveTable: (a, b) => moveTable.mutate({ a, b }),
    addColumn: (tableId, payload) => addColumn.mutate({ tableId, ...payload }),
    updateColumn: (id, payload) => updateColumn.mutate({ id, ...payload }),
    removeColumn: (id) => removeColumn.mutate(id),
    addRows: (tableId, payload) => addRows.mutate({ tableId, ...payload }),
    removeRow: (id) => removeRow.mutate(id),
    renameRow: (id, label) => updateRow.mutate({ id, label }),
    swapRow: (id, player, label) => updateRow.mutate({ id, player, label }),
    unlinkRow: (id) => updateRow.mutate({ id, player: null }),
    addPerson: (userId) => addPerson.mutate(userId),
    removePerson: (userId) => removePerson.mutate(userId),
  }

  return {
    board,
    isLoading,
    friends,
    busyKey,
    actions,
    addingTable: addTable.isPending,
    addPersonError: addPerson.error?.message,
  }
}

// Board with `fn` applied to each table.
function withTables(board, fn) {
  return { ...board, tables: board.tables.map(fn) }
}

// Board with one tally cell moved by `delta`, floored at zero like the server.
function withTally(board, rowId, column, delta) {
  return {
    ...board,
    tables: board.tables.map((table) => ({
      ...table,
      rows: table.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              counts: { ...r.counts, [column]: Math.max(0, (r.counts?.[column] ?? 0) + delta) },
            }
          : r,
      ),
    })),
  }
}
