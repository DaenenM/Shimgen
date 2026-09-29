import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { boards as boardsApi, friends as friendsApi } from '@/api/endpoints'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * One stats board, and every change that can be made to it.
 *
 * Actions come back as plain functions rather than mutation objects: the board
 * has seventeen of them, and the components below only ever need to call one.
 */
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
    // This is the page the numbers are actually read off, and they move
    // whenever any linked bracket is reported — by this tab or by a co-host on
    // their own phone. Always ask on arrival; `placeholderData` keeps the board
    // on screen while it refetches, so the tallies update underneath rather
    // than flashing a loader.
    staleTime: 0,
  })

  // Only the people who can actually be given access: sharing a board is
  // limited to friends, the same rule co-hosting a bracket follows.
  const { data: friendships } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
  })

  // A friendship is stored directionally, so which side is "them" depends on
  // who sent the original request.
  const friends = (friendships ?? [])
    .map((item) => (item.direction === 'outgoing' ? item.to_user : item.from_user))
    .filter(Boolean)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  // Arriving by the bare slug — an old link, or one typed by hand — rewrites
  // the address bar to the named form, so copying from the browser gives the
  // same URL the Share button does. `replace` keeps it out of the back stack.
  const canonical = board ? paths.board(board.slug, board.name) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  // Tallying is a burst of clicks — eight wins for one player is eight taps —
  // and the optimistic write has already drawn each one. Reconciling once the
  // burst ends keeps the board from refetching under the user's finger.
  const reconcile = useDebouncedCallback(refresh, 400)

  /**
   * Add or remove a mark, applied to the cache first.
   *
   * The whole feel of the board is that a win lands the instant you click it —
   * waiting on a round trip to see an emoji appear makes tallying six wins feel
   * like filling in a form.
   */
  const award = useMutation({
    mutationFn: ({ row, column, delta }) => boardsApi.award(slug, row, column, delta),
    onMutate: ({ row, column, delta }) => {
      // Written synchronously, then the in-flight refetch is cancelled without
      // awaiting it: React Query holds the mutation until onMutate resolves, so
      // awaiting the abort first made every tap wait on it.
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

  // The slug is stable and carries the readable name only as decoration, so a
  // rename does not move the board or break a link somebody already holds.
  const renameBoard = useMutation(change((name) => boardsApi.update(slug, { name })))
  const addTable = useMutation(change((payload) => boardsApi.addTable(slug, payload)))
  const renameTable = useMutation(change(({ id, name }) => boardsApi.updateTable(id, { name })))
  const removeTable = useMutation(change((id) => boardsApi.removeTable(id)))

  /**
   * Swap two tables' positions.
   *
   * Two PATCHes rather than one bulk call: `position` is an ordinary writable
   * field and a swap only ever touches a pair, so the endpoint that already
   * exists does the job. Sent together and refreshed once — refreshing after
   * the first would repaint the board while both tables shared a position.
   */
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
  // `label` is the row's own name, so the tallies and any account link stay
  // exactly where they are — renaming changes what the row is called, not who
  // it is. Swapping re-points the row at a friend's account and keeps its
  // tallies, which is the whole reason to do it instead of delete-and-add;
  // unlinking keeps the row, name and tallies and drops only the link.
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

/** The board with one tally cell moved by `delta`, floored at zero like the server. */
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
