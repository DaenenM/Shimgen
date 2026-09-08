import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'

import { roster as rosterApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/PageLoader'
import { queryKeys } from '@/lib/queryClient'

/**
 * The saved roster.
 *
 * Plan §3 calls this the highest ratio of user-delight to engineering effort in
 * the whole product: re-typing ten names every Saturday is precisely the
 * friction that sends people back to a random generator.
 */
export function RosterPage() {
  const queryClient = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const [draft, setDraft] = useState('')
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  // Archived players are always fetched and filtered here rather than by the
  // server. Asking only when the toggle was on meant the count was always zero
  // while it was off — so the control that reveals them never appeared, and an
  // archived name had no way back.
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.roster.all, 'all'],
    queryFn: () => rosterApi.list({ include_archived: 'true' }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.roster.all })

  const add = useMutation({
    mutationFn: (names) => rosterApi.bulk(names),
    onSuccess: invalidate,
  })
  const archive = useMutation({
    mutationFn: (id) => rosterApi.archive(id),
    onSuccess: invalidate,
  })
  const restore = useMutation({
    mutationFn: (id) => rosterApi.restore(id),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id) => rosterApi.remove(id),
    onSuccess: invalidate,
  })

  if (isLoading) return <PageLoader label="Loading roster…" />

  const players = data?.results ?? data ?? []
  const active = players.filter((p) => !p.archived)
  const archived = players.filter((p) => p.archived)

  function submitOne(event) {
    event.preventDefault()
    if (!draft.trim()) return
    add.mutate([draft.trim()])
    setDraft('')
  }

  function submitPaste() {
    const names = pasted
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length) add.mutate(names)
    setPasted('')
    setPasting(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="My Roster"
        description="Names you've saved. They show up as one-click chips when you build an event."
      >
        <button className="btn btn-outline btn-sm" onClick={() => setPasting((p) => !p)}>
          Paste a list
        </button>
      </PageHeader>

      <form onSubmit={submitOne} className="mb-4 flex gap-2">
        <input
          type="text"
          className="input input-bordered flex-1"
          placeholder="Add a name…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-square" aria-label="Add player">
          <Plus className="h-5 w-5" />
        </button>
      </form>

      {pasting && (
        <div className="border-base-300 mb-4 space-y-2 rounded-lg border p-3">
          <textarea
            className="textarea textarea-bordered h-28 w-full font-mono text-sm"
            placeholder={'One name per line, or comma separated\nDaenen\nBrett\nMark'}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setPasting(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={submitPaste}>
              Add them
            </button>
          </div>
        </div>
      )}

      {add.isError && (
        <div role="alert" className="alert alert-error mb-4 py-2 text-sm">
          {add.error.message}
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No saved players"
          description="Add the people you play with and you'll never type their names twice."
        />
      ) : (
        <ul className="grid gap-2">
          {active.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              onArchive={() => archive.mutate(player.id)}
              onRemove={() => remove.mutate(player.id)}
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <div className="border-base-300 mt-8 border-t pt-6">
          {/* A switch rather than a button: this is a view that is on or off,
              and the count says how many names are behind it. */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                Show archived <span className="text-base-content/50">({archived.length})</span>
              </span>
              <span className="text-base-content/50 block text-xs">
                Hidden from the roster picker, with their history kept. Restore any of them to bring
                them back.
              </span>
            </span>
          </label>

          {showArchived && (
            <ul className="mt-3 grid gap-2">
              {archived.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  archived
                  onRestore={() => restore.mutate(player.id)}
                  onRemove={() => remove.mutate(player.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function PlayerRow({ player, archived, onArchive, onRestore, onRemove }) {
  return (
    // An archived row is dimmed and dashed, so the two lists cannot be confused
    // when both are on screen at once.
    <li
      className={`card border ${
        archived ? 'border-base-300/60 bg-base-200/30 border-dashed' : 'bg-base-100 border-base-300'
      }`}
    >
      <div className="card-body flex-row items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${archived ? 'text-base-content/60' : ''}`}>
            {player.display_name}
          </p>
          <p className="text-base-content/50 text-xs">
            {archived ? 'Archived' : player.linked ? 'Linked account' : 'Name only'}
            {player.last_used_at &&
              ` · last played ${new Date(player.last_used_at).toLocaleDateString()}`}
          </p>
        </div>

        <div className="flex gap-1">
          {archived ? (
            <button
              className="btn btn-primary btn-xs gap-1"
              onClick={onRestore}
              title="Put them back on the roster"
              aria-label={`Restore ${player.display_name}`}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-xs"
              onClick={onArchive}
              title="Archive — hides them without losing their history"
              aria-label={`Archive ${player.display_name}`}
            >
              <Archive className="h-4 w-4" />
            </button>
          )}

          <button
            className="btn btn-ghost btn-xs text-error"
            onClick={onRemove}
            title="Delete permanently"
            aria-label={`Delete ${player.display_name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  )
}
