import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { boards as boardsApi, friends as friendsApi } from '@/api/endpoints'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
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

  // Every structural change is a request followed by a refetch.
  const change = (mutationFn, options = {}) => ({ mutationFn, onSuccess: refresh, ...options })

  // Slug stays stable across a rename, so existing links keep working.
  const renameBoard = useMutation(change((name) => boardsApi.update(slug, { name })))
  const addTable = useMutation(change((payload) => boardsApi.addTable(slug, payload)))
  const renameTable = useMutation(change(({ id, name }) => boardsApi.updateTable(id, { name })))
  const removeTable = useMutation(change((id) => boardsApi.removeTable(id)))

  // Swaps two tables' positions via two PATCHes sent together, refreshed once
  // (refreshing after only the first would repaint mid-swap).
  const moveTable = useMutation(
    change(({ a, b }) =>
      Promise.all([
        boardsApi.updateTable(a.id, { position: b.position }),
        boardsApi.updateTable(b.id, { position: a.position }),
      ]),
    ),
  )

  const addColumn = useMutation(
    change(({ tableId, ...payload }) => boardsApi.addColumn(tableId, payload)),
  )
  const updateColumn = useMutation(
    change(({ id, ...payload }) => boardsApi.updateColumn(id, payload)),
  )
  const removeColumn = useMutation(change((id) => boardsApi.removeColumn(id)))

  const addRows = useMutation(
    change(({ tableId, ...payload }) => boardsApi.addRows(tableId, payload)),
  )
  const removeRow = useMutation(change((id) => boardsApi.removeRow(id)))
  // Renaming/swapping/unlinking a row all keep its tallies; only `label` or `player` changes.
  const updateRow = useMutation(change(({ id, ...payload }) => boardsApi.updateRow(id, payload)))

  const addPerson = useMutation(
    change((userId) => boardsApi.addPerson(slug, userId), { meta: { errorShown: true } }),
  )
  const removePerson = useMutation(change((userId) => boardsApi.removePerson(slug, userId)))

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
