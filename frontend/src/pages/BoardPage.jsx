import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Link2,
  Plus,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from '@/components/icons'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { boards as boardsApi, friends as friendsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { BoardTable } from '@/features/stats/BoardTable'
import { EmojiPicker } from '@/features/stats/EmojiPicker'
import { useRoster } from '@/hooks/useRoster'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * One stats board.
 *
 * Reading it is the common case — it sits open on a second monitor during game
 * night — so tallying is one click and everything structural hides behind an
 * edit toggle. Anyone with the link can read it; only the owner and the people
 * they invited can change it.
 */
export function BoardPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { players: roster } = useRoster()

  // Only asked for by the owner, and only the people who can actually be given
  // access: sharing a board is limited to friends, the same rule co-hosting a
  // bracket follows.
  const { data: friendships } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
  })

  // A friendship is stored directionally, so which side is "them" depends on
  // who sent the original request.
  const friendList = (friendships ?? [])
    .map((item) => (item.direction === 'outgoing' ? item.to_user : item.from_user))
    .filter(Boolean)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  const [editing, setEditing] = useState(false)
  const [busyKey, setBusyKey] = useState(null)
  const [copied, setCopied] = useState(false)

  const { data: board, isLoading } = useQuery({
    queryKey: queryKeys.boards.detail(slug),
    queryFn: () => boardsApi.get(slug),
    // This is the page the numbers are actually read off, and they move
    // whenever any linked bracket is reported — by this tab or by a co-host on
    // their own phone. Always ask on arrival; `placeholderData` keeps the board
    // on screen while it refetches, so the tallies update underneath rather
    // than flashing a loader.
    staleTime: 0,
  })

  // Arriving by the bare slug — an old link, or one typed by hand — rewrites
  // the address bar to the named form, so copying from the browser gives the
  // same URL the Share button does. `replace` keeps it out of the back stack.
  const canonical = board ? paths.board(board.slug, board.name) : null

  useEffect(() => {
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [canonical, location.pathname, navigate])

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(slug) })

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
      const key = queryKeys.boards.detail(slug)

      // Written synchronously, then the in-flight refetch is cancelled without
      // awaiting it: React Query holds the mutation until onMutate resolves, so
      // awaiting the abort first made every tap wait on it.
      const previous = queryClient.getQueryData(key)
      if (previous) {
        queryClient.setQueryData(key, {
          ...previous,
          tables: previous.tables.map((table) => ({
            ...table,
            rows: table.rows.map((r) =>
              r.id === row
                ? {
                    ...r,
                    counts: {
                      ...r.counts,
                      // Floored here as well as on the server, so the optimistic
                      // view matches what will come back.
                      [column]: Math.max(0, (r.counts?.[column] ?? 0) + delta),
                    },
                  }
                : r,
            ),
          })),
        })
      }

      queryClient.cancelQueries({ queryKey: key })

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.boards.detail(slug), context.previous)
      }
    },
    onSettled: () => {
      setBusyKey(null)
      reconcile()
    },
  })

  /**
   * Rename the board itself.
   *
   * Owner only, like every other structural change — an editor may tally all
   * night without being able to reshape what everyone's history lives under.
   *
   * The slug is stable and carries the readable name only as decoration, so a
   * rename does not move the board or break a link somebody already holds.
   */
  const renameBoard = useMutation({
    mutationFn: (name) => boardsApi.update(slug, { name }),
    onSuccess: refresh,
  })

  const addTable = useMutation({
    mutationFn: (payload) => boardsApi.addTable(slug, payload),
    onSuccess: refresh,
  })

  const renameTable = useMutation({
    mutationFn: ({ id, name }) => boardsApi.updateTable(id, { name }),
    onSuccess: refresh,
  })

  const removeTable = useMutation({
    mutationFn: (id) => boardsApi.removeTable(id),
    onSuccess: refresh,
  })

  /**
   * Swap two tables' positions.
   *
   * Two PATCHes rather than one bulk call: `position` is an ordinary writable
   * field and a swap only ever touches a pair, so the endpoint that already
   * exists does the job. Sent together and refreshed once — refreshing after
   * the first would repaint the board while both tables shared a position.
   */
  const moveTable = useMutation({
    mutationFn: ({ a, b }) =>
      Promise.all([
        boardsApi.updateTable(a.id, { position: b.position }),
        boardsApi.updateTable(b.id, { position: a.position }),
      ]),
    onSuccess: refresh,
  })

  const updateColumn = useMutation({
    mutationFn: ({ id, ...payload }) => boardsApi.updateColumn(id, payload),
    onSuccess: refresh,
  })

  const removeColumn = useMutation({
    mutationFn: (id) => boardsApi.removeColumn(id),
    onSuccess: refresh,
  })

  const addColumn = useMutation({
    mutationFn: ({ tableId, ...payload }) => boardsApi.addColumn(tableId, payload),
    onSuccess: refresh,
  })

  const addRows = useMutation({
    mutationFn: ({ tableId, ...payload }) => boardsApi.addRows(tableId, payload),
    onSuccess: refresh,
  })

  const removeRow = useMutation({
    mutationFn: (id) => boardsApi.removeRow(id),
    onSuccess: refresh,
  })

  /**
   * Point an existing row at a friend's account.
   *
   * The row is kept and re-linked rather than replaced, so the tallies already
   * on it stay where they are — which is the whole reason to do this instead of
   * deleting the old name and adding a new one.
   *
   * The label is updated too: the row should read as the person it now is.
   */
  const swapRow = useMutation({
    mutationFn: ({ id, player, label }) => boardsApi.updateRow(id, { player, label }),
    onSuccess: refresh,
  })

  /**
   * Rename a competitor on the board.
   *
   * Writes `label`, the row's own name, so the tallies and any account link
   * stay exactly where they are — this changes what the row is called, not who
   * it is.
   */
  const renameRow = useMutation({
    mutationFn: ({ id, label }) => boardsApi.updateRow(id, { label }),
    onSuccess: refresh,
  })

  /**
   * Cut a row loose from the account behind it.
   *
   * The row, its name and its tallies all stay — only the link goes. That is
   * what makes this safe to offer: the board keeps its history, and the person
   * simply stops being tied to it. Linking again is one swap away.
   */
  const unlinkRow = useMutation({
    mutationFn: (id) => boardsApi.updateRow(id, { player: null }),
    onSuccess: refresh,
  })

  const addPerson = useMutation({
    mutationFn: (userId) => boardsApi.addPerson(slug, userId),
    onSuccess: refresh,
  })

  const removePerson = useMutation({
    mutationFn: (userId) => boardsApi.removePerson(slug, userId),
    onSuccess: refresh,
  })

  const removeBoard = useMutation({
    mutationFn: () => boardsApi.remove(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
      navigate(paths.stats)
    },
  })

  if (isLoading) return <SkeletonPage width="max-w-5xl" />

  if (!board) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">No such board</h1>
        <Link
          to={paths.stats}
          className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 mt-4 inline-flex h-10 items-center rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
        >
          Back to stats
        </Link>
      </div>
    )
  }

  const canEdit = board.role === 'owner' || board.role === 'editor'
  const isOwner = board.role === 'owner'

  function share() {
    // Built from the board rather than read off the address bar, so the copied
    // link carries the name even when this page was reached by the bare slug.
    const url = `${window.location.origin}${paths.board(board.slug, board.name)}`

    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <PageShell className="glass-backdrop">
      <Link
        to={paths.stats}
        className="text-base-content/60 hover:text-base-content mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All boards
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {editing && isOwner ? (
            <BoardName name={board.name} onRename={(name) => renameBoard.mutate(name)} />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{board.name}</h1>
          )}
          {board.description && (
            <p className="text-base-content/60 mt-1 text-sm">{board.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            onClick={share}
          >
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Copied' : 'Share'}
          </button>

          {/* Solid while editing, glass at rest. The mode is the thing worth
              signalling: "Done" is the way out of a state the board is
              currently in, so it gets the page's one opaque treatment, while
              "Edit" is just another header control beside Share. */}
          {canEdit && (
            <button
              className={`flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out active:translate-y-0 active:scale-[0.98] ${
                editing
                  ? 'bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 shadow-md hover:-translate-y-0.5 hover:shadow-lg'
                  : 'glass-raised hover:border-base-content/30 hover:bg-base-content/5 hover:-translate-y-0.5'
              }`}
              onClick={() => setEditing((on) => !on)}
            >
              {editing ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="glass-inset mb-6 flex items-start gap-2.5 p-3 text-sm">
          <Users className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <p>You are viewing this board. Ask its owner for access to add wins.</p>
        </div>
      )}

      <div className="space-y-5">
        {board.tables.map((table, index) => (
          <TableCard
            key={table.id}
            table={table}
            canEdit={canEdit}
            editing={editing}
            // Disabled at the ends rather than hidden, so the control cluster
            // keeps its width as a table reaches the top or the bottom.
            onMoveUp={
              index > 0 ? () => moveTable.mutate({ a: table, b: board.tables[index - 1] }) : null
            }
            onMoveDown={
              index < board.tables.length - 1
                ? () => moveTable.mutate({ a: table, b: board.tables[index + 1] })
                : null
            }
            onEditColumn={(id, payload) => updateColumn.mutate({ id, ...payload })}
            onRemoveColumn={(id) => removeColumn.mutate(id)}
            roster={roster}
            busyKey={busyKey}
            onAward={(row, column, delta) => {
              setBusyKey(`${row}:${column}`)
              award.mutate({ row, column, delta })
            }}
            onRemoveRow={(row) => removeRow.mutate(row.id)}
            onSwapRow={(id, player, label) => swapRow.mutate({ id, player, label })}
            onRenameRow={(id, label) => renameRow.mutate({ id, label })}
            onUnlinkRow={(id) => unlinkRow.mutate(id)}
            onAddColumn={(payload) => addColumn.mutate({ tableId: table.id, ...payload })}
            onAddRows={(payload) => addRows.mutate({ tableId: table.id, ...payload })}
            onRename={(name) => renameTable.mutate({ id: table.id, name })}
            onRemove={() => removeTable.mutate(table.id)}
          />
        ))}
      </div>

      {editing && (
        <AddTable onAdd={(payload) => addTable.mutate(payload)} pending={addTable.isPending} />
      )}

      {editing && isOwner && (
        <People
          people={board.people}
          friends={friendList}
          onAdd={(userId) => addPerson.mutate(userId)}
          onRemove={(userId) => removePerson.mutate(userId)}
          error={addPerson.error?.message}
          onDeleteBoard={() => removeBoard.mutate()}
          boardName={board.name}
        />
      )}
    </PageShell>
  )
}

/** One table, with the controls that only appear in edit mode. */
function TableCard({
  table,
  canEdit,
  editing,
  roster,
  busyKey,
  onAward,
  onRemoveRow,
  onAddColumn,
  onAddRows,
  onRename,
  onRemove,
  onMoveUp,
  onMoveDown,
  onEditColumn,
  onRemoveColumn,
  onSwapRow,
  onRenameRow,
  onUnlinkRow,
}) {
  const [addingColumn, setAddingColumn] = useState(false)
  const [addingRows, setAddingRows] = useState(false)

  return (
    <div className="glass-panel">
      <div className="card-body gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <TableName name={table.name} onRename={onRename} />
          ) : (
            <h2 className="text-lg font-semibold">{table.name}</h2>
          )}

          {editing && (
            <div className="flex items-center gap-2">
              {/* Arrows rather than drag: no new dependency, works from the
                  keyboard, and a board holds a handful of tables — the
                  precision dragging buys is precision nobody needs here. */}
              <div className="flex items-center">
                <button
                  className="text-base-content/50 hover:bg-base-content/8 hover:text-base-content grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-25"
                  onClick={() => onMoveUp?.()}
                  disabled={!onMoveUp}
                  aria-label={`Move the ${table.name} table up`}
                  title="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  className="text-base-content/50 hover:bg-base-content/8 hover:text-base-content grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-25"
                  onClick={() => onMoveDown?.()}
                  disabled={!onMoveDown}
                  aria-label={`Move the ${table.name} table down`}
                  title="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <button
                className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
                onClick={() => setAddingRows((on) => !on)}
              >
                <UserPlus className="h-4 w-4" />
                Players
              </button>
              <button
                className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
                onClick={() => setAddingColumn((on) => !on)}
              >
                <Plus className="h-4 w-4" />
                Column
              </button>
              <button
                className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150"
                onClick={() => onRemove()}
                aria-label={`Delete the ${table.name} table`}
                title="Delete this table"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {addingRows && editing && (
          // Stays open across adds. Adding players is done in a run — a name
          // from the roster, three more pasted, one typed — and closing after
          // each one meant reopening the panel for every person.
          <AddRows
            roster={roster}
            existing={table.rows}
            onAdd={onAddRows}
            onDone={() => setAddingRows(false)}
          />
        )}

        {addingColumn && editing && (
          <AddColumn
            onAdd={(payload) => {
              onAddColumn(payload)
              setAddingColumn(false)
            }}
            onCancel={() => setAddingColumn(false)}
          />
        )}

        <BoardTable
          table={table}
          canEdit={canEdit && !editing ? true : canEdit}
          editing={editing}
          busyKey={busyKey}
          onAward={onAward}
          onRemoveRow={onRemoveRow}
          onEditColumn={onEditColumn}
          onRemoveColumn={onRemoveColumn}
          onSwapRow={onSwapRow}
          onRenameRow={onRenameRow}
          onUnlinkRow={onUnlinkRow}
          // Friends and yourself. Swapping a row onto somebody's account
          // attaches their record to this board, and a friendship is the
          // consent that makes that reasonable — your own account needs no
          // such permission, and tallying yourself under a typed name is
          // exactly as common as doing it for somebody else.
          friends={roster.filter((player) => player.is_friend || player.is_self)}
        />
      </div>
    </div>
  )
}

/**
 * The board's name, editable in place.
 *
 * Same gesture as the table names one level down: commits on blur as well as
 * Enter, because renaming and then clicking straight back into the board is the
 * natural thing to do and losing the edit for want of a keypress is the kind of
 * thing you only notice afterwards.
 */
function BoardName({ name, onRename }) {
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    else setDraft(name)
  }

  return (
    <input
      className="glass-inset focus:border-primary/50 h-11 w-full max-w-sm px-3 text-2xl font-bold tracking-tight transition-colors focus:outline-none sm:text-3xl"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(name)
          event.currentTarget.blur()
        }
      }}
      aria-label="Board name"
    />
  )
}

/**
 * The table's name, editable in place.
 *
 * Commits on blur as well as Enter: renaming and then clicking straight into
 * the board is the natural gesture, and losing the edit for want of a keypress
 * is the kind of thing you only notice after it has happened.
 */
function TableName({ name, onRename }) {
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    else setDraft(name)
  }

  return (
    <input
      className="glass-inset focus:border-primary/50 h-10 w-48 px-3 text-lg font-semibold transition-colors focus:outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(name)
          e.currentTarget.blur()
        }
      }}
      aria-label="Table name"
    />
  )
}

/** Name a new countable thing and choose its mark. */
function AddColumn({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('\u{1F531}')

  // One row rather than a stack of labelled blocks. A column is a short name
  // and a glyph; the full-width field and the two headings around it made a
  // two-word answer look like a form worth filling in.
  return (
    <div className="glass-inset space-y-2 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 w-40 px-3 text-sm transition-colors focus:outline-none"
          placeholder="Column name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onAdd({ name: name.trim(), emoji })
            if (e.key === 'Escape') onCancel()
          }}
          aria-label="Column name"
        />

        <span className="text-base-content/40 text-xs">marked</span>

        <span className="grid h-9 w-9 shrink-0 place-items-center text-lg" aria-hidden="true">
          {emoji}
        </span>

        <div className="ml-auto flex gap-2">
          <button
            className="bg-primary text-primary-content hover:bg-primary/90 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
            disabled={!name.trim()}
            onClick={() => onAdd({ name: name.trim(), emoji })}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          <button
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      <EmojiPicker value={emoji} onChange={setEmoji} />
    </div>
  )
}

/**
 * Add competitors, from the saved roster or pasted.
 *
 * A roster name comes with its player link, which is what lets a finished
 * tournament find this row later — so those chips are offered first.
 */
function AddRows({ roster, existing, onAdd, onDone }) {
  const [pasted, setPasted] = useState('')

  function addPasted() {
    if (!pasted.trim()) return
    onAdd({ names: pasted.split(/[\n,]/) })
    // Cleared so the next batch starts empty — the panel stays open, and
    // leaving the names in it would re-add them on the following click.
    setPasted('')
  }

  const taken = new Set(existing.map((row) => row.display_name.toLowerCase()))
  const unused = roster.filter((p) => !taken.has(p.display_name.toLowerCase()))

  return (
    <div className="glass-inset space-y-3 p-3">
      {unused.length > 0 && (
        <div>
          <span className="text-base-content/60 mb-1.5 block text-xs font-semibold tracking-wide uppercase">
            Saved roster
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unused.map((player) => (
              <button
                key={player.id ?? player.display_name}
                type="button"
                onClick={() =>
                  onAdd({
                    player_ids: player.id ? [player.id] : [],
                    names: player.id ? [] : [player.display_name],
                  })
                }
                className="glass-raised hover:border-primary/50 hover:text-primary h-8 rounded-full px-3 text-sm transition-colors duration-150"
              >
                {player.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 w-full resize-none p-3 text-sm transition-colors focus:outline-none"
        rows={2}
        placeholder={'One name per line, or comma separated'}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        // Enter inserts a newline, as a textarea should. Submitting on it
        // fought the box's own purpose: typing a list one name per line added
        // the first name and cleared the rest.
        aria-label="Add players"
      />

      <div className="flex flex-wrap gap-2">
        <button
          className="bg-primary text-primary-content hover:bg-primary/90 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
          disabled={!pasted.trim()}
          onClick={addPasted}
        >
          <Plus className="h-4 w-4" />
          Add them
        </button>

        {/* The panel closes here rather than after each add, so a run of
            players is one visit instead of one visit per name. */}
        <button
          className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
          onClick={onDone}
        >
          <Check className="h-4 w-4" />
          Done
        </button>
      </div>
    </div>
  )
}

/** A second section on the board — "Teams" alongside "Solo". */
function AddTable({ onAdd, pending }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('⚜️')
  // Two genuinely different kinds of table, and the choice decides what the
  // table can do afterwards, so it is made here rather than buried in settings.
  const [tracks, setTracks] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-base-content/15 text-base-content/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-medium transition-colors duration-150"
      >
        <Plus className="h-4 w-4" />
        Add a table
      </button>
    )
  }

  return (
    <div className="glass-panel mt-5">
      <div className="card-body gap-3 p-4">
        <label className="flex w-full flex-col">
          <span className="label-text mb-1 text-sm">Table name</span>
          <input
            className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 w-full px-3 text-sm transition-colors focus:outline-none"
            placeholder="Teams"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            [false, 'Counted by hand', 'You add each win yourself.'],
            [true, 'From tournaments', 'Games and wins fill in by themselves.'],
          ].map(([value, label, hint]) => (
            <label
              key={String(value)}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                tracks === value
                  ? 'border-primary bg-primary/5'
                  : 'glass-inset hover:border-base-content/25'
              }`}
            >
              <input
                type="radio"
                name="table-kind"
                className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                checked={tracks === value}
                onChange={() => setTracks(value)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-base-content/50 block text-xs">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {/* A tracking table's columns come with their own marks, so there is
            nothing to choose here. */}
        {!tracks && (
          <div>
            <span className="label-text mb-1.5 block text-sm">Mark for its first column</span>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="bg-primary text-primary-content hover:bg-primary/90 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
            disabled={!name.trim() || pending}
            onClick={() => {
              onAdd({ name: name.trim(), emoji, tracks_tournaments: tracks })
              setOpen(false)
              setName('')
            }}
          >
            <Plus className="h-4 w-4" />
            Add table
          </button>
          <button
            className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Who else can add to this board.
 *
 * Owner-only, because an editor who could hand out access could hand it to
 * anyone — which would leave the owner's control over the board nominal.
 */
function People({ people, friends, onAdd, onRemove, error, onDeleteBoard, boardName }) {
  const [confirming, setConfirming] = useState(false)

  // Keyed by account id, which is what both halves of the toggle address.
  const granted = new Set(people.map((person) => person.user))

  return (
    <div className="glass-panel mt-5">
      <div className="card-body gap-4 p-4 sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5" />
            Who can add wins
          </h2>
          <p className="text-base-content/50 mt-0.5 text-sm">
            Editors can tally and link tournaments to this board. Only you can change its shape or
            share it further.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
          >
            {error}
          </div>
        )}

        {/* One list, not two. This used to stack a picker above a separate
            row of removable names, so the same person appeared in one place or
            the other depending on state and granting and revoking were two
            different gestures. Every friend now has exactly one row that
            toggles — the same treatment the tournament permissions popover
            uses, where a tick means "in" and becomes a cross on hover to say
            what the click will do. */}
        {friends.length === 0 ? (
          <div className="border-base-content/10 rounded-xl border border-dashed p-4 text-center">
            <Users className="text-base-content/30 mx-auto h-6 w-6" />
            <p className="text-base-content/60 mt-2 text-sm">
              Add someone as a friend first, then you can share this board with them.
            </p>
          </div>
        ) : (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {friends.map((person) => {
              const added = granted.has(person.id)

              return (
                <li key={person.id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => (added ? onRemove(person.id) : onAdd(person.id))}
                    aria-pressed={added}
                    title={added ? `Remove ${person.name}` : `Let ${person.name} add wins`}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 ${
                      added
                        ? 'text-success hover:bg-error/10 hover:text-error'
                        : 'hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {added ? (
                      <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
                        <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
                        <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                      </span>
                    ) : (
                      <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    )}
                    <span className="truncate font-medium">{person.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* Deleting takes everyone's accumulated history with it, so it asks
            first rather than living one click away. */}
        <div className="border-base-content/10 mt-2 border-t pt-4">
          <button
            className="text-base-content/50 hover:text-error text-sm transition-colors"
            onClick={() => setConfirming(true)}
          >
            Delete this board
          </button>

          <ConfirmDialog
            open={confirming}
            title={`Delete ${boardName}?`}
            message="Every table, player and tally on it goes too. This cannot be undone."
            confirmLabel="Delete board"
            onConfirm={onDeleteBoard}
            onCancel={() => setConfirming(false)}
          />
        </div>
      </div>
    </div>
  )
}
