import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Plus, Trash2, User, Users } from '@/components/icons'
import { useState } from 'react'

import { roster as rosterApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCards } from '@/components/ui/Skeleton'
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
    <div className="glass-backdrop mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="My Roster"
        description="Names you've saved. They show up as one-click chips when you build an event."
      >
        <button
          className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          onClick={() => setPasting((p) => !p)}
        >
          Paste a list
        </button>
      </PageHeader>

      <form onSubmit={submitOne} className="mb-4 flex gap-2">
        <input
          type="text"
          className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 flex-1 px-3 text-sm transition-colors focus:outline-none"
          placeholder="Add a name…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          aria-label="Add player"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      {pasting && (
        <div className="glass-inset mb-4 space-y-2 p-3">
          <textarea
            className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-28 w-full resize-none p-3 font-mono text-sm transition-colors focus:outline-none"
            placeholder={'One name per line, or comma separated\nMark\nDaniel\nJacob'}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
              onClick={() => setPasting(false)}
            >
              Cancel
            </button>
            <button
              className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              onClick={submitPaste}
            >
              Add them
            </button>
          </div>
        </div>
      )}

      {add.isError && (
        <div
          role="alert"
          className="border-error/30 bg-error/12 text-error mb-4 rounded-xl border px-3 py-2 text-sm"
        >
          {add.error.message}
        </div>
      )}

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : active.length === 0 ? (
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
        <div className="border-base-content/10 mt-8 border-t pt-6">
          {/* A switch rather than a button: this is a view that is on or off,
              and the count says how many names are behind it. */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="accent-primary h-4 w-4 shrink-0"
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
  // No words for either kind of linked row: the icon beside the name says it,
  // and spelling the same fact out underneath was saying it twice. Being
  // archived is the one state the row cannot show any other way.
  const status = archived ? 'Archived' : null

  const played = player.last_used_at
    ? `last played ${new Date(player.last_used_at).toLocaleDateString()}`
    : null

  // Joined rather than concatenated with a hard separator, so whichever half is
  // missing does not leave a dangling dot.
  const meta = [status, played].filter(Boolean).join(' · ')

  return (
    // An archived row is dimmed and dashed, so the two lists cannot be confused
    // when both are on screen at once.
    <li
      className={
        archived
          ? 'border-base-content/12 rounded-xl border border-dashed opacity-70'
          : 'glass-inset'
      }
    >
      <div className="flex flex-row items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 truncate text-sm font-medium ${archived ? 'text-base-content/60' : ''}`}
          >
            <span className="truncate">{player.display_name}</span>

            {/* The meta line below already says "Follows their name", so here
                the glyph is reinforcement rather than the only signal. */}
            {player.is_friend ? (
              <Users className="text-primary h-3.5 w-3.5 shrink-0" aria-label="Friend" role="img" />
            ) : (
              // An account attached without being a friend — somebody who
              // claimed a bracket, say. Amber rather than the friend blue:
              // `--color-accent` is the hue the backdrop mesh already warms the
              // page with, so a second kind of link reads as related to the
              // first without being mistaken for it.
              player.linked && (
                <User
                  className="text-accent h-3.5 w-3.5 shrink-0"
                  aria-label="Linked account"
                  role="img"
                />
              )
            )}
          </p>
          {/* A plain roster entry says nothing here. "Name only" described the
              absence of a link, which is the ordinary case — most of a roster
              is names somebody typed — so it was a label on nothing.

              Computed above the markup rather than nested further: with the
              fallback gone the ternary would have ended in an empty string,
              and the separator below would then have rendered a stray
              " · last played" with nothing in front of it. */}
          {meta && <p className="text-base-content/50 text-xs">{meta}</p>}
        </div>

        <div className="flex gap-1">
          {archived ? (
            <button
              className="bg-primary text-primary-content hover:bg-primary/90 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150"
              onClick={onRestore}
              title="Put them back on the roster"
              aria-label={`Restore ${player.display_name}`}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore
            </button>
          ) : (
            <button
              className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
              onClick={onArchive}
              title="Archive: hides them without losing their history"
              aria-label={`Archive ${player.display_name}`}
            >
              <Archive className="h-4 w-4" />
            </button>
          )}

          <button
            className="text-error hover:bg-error/10 inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
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
