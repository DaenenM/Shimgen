import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
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

import { boards as boardsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FriendPicker } from '@/components/ui/FriendPicker'
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
        <Link to={paths.stats} className="btn btn-primary btn-sm mt-4">
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
    <PageShell>
      <Link
        to={paths.stats}
        className="text-base-content/60 hover:text-base-content mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All boards
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{board.name}</h1>
          {board.description && (
            <p className="text-base-content/60 mt-1 text-sm">{board.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost gap-2" onClick={share}>
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Copied' : 'Share'}
          </button>

          {canEdit && (
            <button
              className={`btn gap-2 ${editing ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEditing((on) => !on)}
            >
              {editing ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="alert bg-base-100 border-base-300 mb-6 items-start border py-2 text-sm">
          <Users className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <p>You are viewing this board. Ask its owner for access to add wins.</p>
        </div>
      )}

      <div className="space-y-5">
        {board.tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            canEdit={canEdit}
            editing={editing}
            roster={roster}
            busyKey={busyKey}
            onAward={(row, column, delta) => {
              setBusyKey(`${row}:${column}`)
              award.mutate({ row, column, delta })
            }}
            onRemoveRow={(row) => removeRow.mutate(row.id)}
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
}) {
  const [addingColumn, setAddingColumn] = useState(false)
  const [addingRows, setAddingRows] = useState(false)

  return (
    <div className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <TableName name={table.name} onRename={onRename} />
          ) : (
            <h2 className="text-lg font-semibold">{table.name}</h2>
          )}

          {editing && (
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm gap-1.5"
                onClick={() => setAddingRows((on) => !on)}
              >
                <UserPlus className="h-4 w-4" />
                Players
              </button>
              <button
                className="btn btn-ghost btn-sm gap-1.5"
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
          busyKey={busyKey}
          onAward={onAward}
          onRemoveRow={onRemoveRow}
        />
      </div>
    </div>
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
      className="input input-bordered input-sm w-48 rounded-lg text-lg font-semibold"
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

  return (
    <div className="border-base-300 bg-base-200/40 space-y-3 rounded-xl border p-3">
      <label className="flex w-full flex-col">
        <span className="label-text mb-1 text-sm">Column name</span>
        <input
          className="input input-bordered input-sm w-full rounded-lg"
          placeholder="Wins"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div>
        <span className="label-text mb-1.5 block text-sm">Mark</span>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>

      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm gap-1.5"
          disabled={!name.trim()}
          onClick={() => onAdd({ name: name.trim(), emoji })}
        >
          <Plus className="h-4 w-4" />
          Add column
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
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
    <div className="border-base-300 bg-base-200/40 space-y-3 rounded-xl border p-3">
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
                className="border-base-300 bg-base-100 hover:border-primary/60 hover:text-primary h-8 rounded-full border px-3 text-sm transition-colors duration-150"
              >
                {player.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        className="textarea textarea-bordered w-full rounded-lg text-sm"
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
          className="btn btn-primary btn-sm gap-1.5"
          disabled={!pasted.trim()}
          onClick={addPasted}
        >
          <Plus className="h-4 w-4" />
          Add them
        </button>

        {/* The panel closes here rather than after each add, so a run of
            players is one visit instead of one visit per name. */}
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onDone}>
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
        className="border-base-300 text-base-content/60 hover:border-primary/60 hover:text-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-medium transition-colors duration-150"
      >
        <Plus className="h-4 w-4" />
        Add a table
      </button>
    )
  }

  return (
    <div className="card bg-base-100 border-base-300 mt-5 border">
      <div className="card-body gap-3 p-4">
        <label className="flex w-full flex-col">
          <span className="label-text mb-1 text-sm">Table name</span>
          <input
            className="input input-bordered input-sm w-full rounded-lg"
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
                  : 'border-base-300 hover:border-base-content/20'
              }`}
            >
              <input
                type="radio"
                name="table-kind"
                className="radio radio-primary radio-xs mt-0.5"
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
            className="btn btn-primary btn-sm gap-1.5"
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
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
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
function People({ people, onAdd, onRemove, error, onDeleteBoard, boardName }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="card bg-base-100 border-base-300 mt-5 border">
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

        {/* Chosen from your friends rather than typed as an email: editing
            writes into everyone's history, and a friendship is a mutual act in
            a way that knowing an address is not. */}
        <FriendPicker
          selected={people.map((person) => person.user)}
          exclude={people.map((person) => person.user)}
          onToggle={(person) => onAdd(person.id)}
          emptyHint="Add someone as a friend first, then you can share this board with them."
        />

        {error && (
          <div role="alert" className="alert alert-error py-2 text-sm">
            {error}
          </div>
        )}

        {people.length > 0 && (
          <ul className="space-y-1.5">
            {people.map((person) => (
              <li
                key={person.id}
                className="border-base-300 bg-base-200/40 group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">
                  {person.display_name || person.username}
                </span>
                <button
                  onClick={() => onRemove(person.user)}
                  aria-label={`Remove ${person.display_name || person.username}`}
                  className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Deleting takes everyone's accumulated history with it, so it asks
            first rather than living one click away. */}
        <div className="border-base-300 mt-2 border-t pt-4">
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
