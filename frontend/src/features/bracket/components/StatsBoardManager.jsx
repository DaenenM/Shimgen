import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { unwrapList } from '@/api/client'
import { boards as boardsApi } from '@/api/endpoints'
import { BarChart3, ChevronDown, Plus } from '@/components/icons'
import { useDismiss } from '@/hooks/useDismiss'
import { queryKeys } from '@/lib/queryClient'

import { BoardLinkOption } from './BoardLinkOption'

// Lets a host change which stats board a running tournament feeds, so a board
// linked mid-tournament still gets full credit for the night. Used by
// TournamentHeader.jsx. Host + signed-in only.
export function StatsBoardManager({ board, onLink, pending, error }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [making, setMaking] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const container = useRef(null)

  useDismiss(container, open, () => setOpen(false))

  // Only fetched once the menu opens.
  const { data } = useQuery({
    queryKey: queryKeys.boards.all,
    queryFn: boardsApi.list,
    enabled: open,
  })

  // Only boards the host can edit and that are built to receive a tournament
  // (linking would restructure a hand-counted board).
  const editable = unwrapList(data).filter(
    (item) => (item.role === 'owner' || item.role === 'editor') && item.tracks_tournaments,
  )

  // Creates a tournament-tracking board without leaving the bracket page.
  async function create() {
    const trimmed = name.trim()
    if (!trimmed) return

    setCreating(true)
    setCreateError(null)

    try {
      const made = await boardsApi.create({ name: trimmed, tracks_tournaments: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
      setMaking(false)
      setName('')
      onLink(made.slug)
      setOpen(false)
    } catch (failure) {
      setCreateError(failure?.message ?? 'That board could not be created.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={container} className="static sm:relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={
          board
            ? `Counting towards ${board.name}${board.table_name ? ` — ${board.table_name}` : ''}`
            : 'This tournament is not being counted'
        }
        // Shrinks first on a phone, since it's the only control carrying text.
        className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 max-w-[7rem] min-w-0 shrink items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:max-w-[13rem] sm:shrink-0 sm:gap-2 sm:px-4"
        disabled={pending}
      >
        <BarChart3 className={`h-4 w-4 shrink-0 ${board ? 'text-primary' : ''}`} />
        {/* Board name only, even with a table linked — too narrow to show both. */}
        <span className="truncate">{board ? board.name : 'No board'}</span>
        <ChevronDown
          className={`text-base-content/40 h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="glass-raised absolute inset-x-0 top-full z-50 mt-2 overflow-hidden p-1.5 sm:inset-x-auto sm:right-0 sm:w-72">
          <p className="text-base-content/45 px-2.5 pt-1 pb-1.5 text-xs font-semibold tracking-wide uppercase">
            Stats board
          </p>

          {making ? (
            <div className="p-1.5">
              <input
                className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 w-full px-3 text-sm transition-colors focus:outline-none"
                placeholder="Board name"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && name.trim()) {
                    event.preventDefault()
                    create()
                  }
                  if (event.key === 'Escape') setMaking(false)
                }}
                aria-label="New board name"
              />

              {createError && <p className="text-error mt-1.5 text-xs">{createError}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content h-8 rounded-lg px-3 text-sm font-medium transition-colors"
                  onClick={() => setMaking(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bg-primary text-primary-content hover:bg-primary/90 h-8 rounded-lg px-3 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40"
                  disabled={!name.trim() || creating}
                  onClick={create}
                >
                  {creating ? <span className="loading loading-spinner loading-xs" /> : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                <BoardLinkOption
                  label="Not counted"
                  hint="This night stays off every board"
                  selected={!board}
                  onSelect={() => {
                    onLink('')
                    setOpen(false)
                  }}
                />

                {/* A board with multiple tables offers each table separately,
                    since the server can't guess which one a night belongs on. */}
                {editable.flatMap((item) => {
                  const tables = (item.tables_summary ?? []).filter((t) => t.tracks_tournaments)

                  if (tables.length <= 1) {
                    return [
                      <BoardLinkOption
                        key={item.slug}
                        label={item.name}
                        hint={tables[0]?.name ?? 'Tracks tournaments'}
                        selected={board?.slug === item.slug}
                        onSelect={() => {
                          onLink(item.slug)
                          setOpen(false)
                        }}
                      />,
                    ]
                  }

                  return tables.map((table) => (
                    <BoardLinkOption
                      key={`${item.slug}:${table.id}`}
                      label={`${item.name} — ${table.name}`}
                      hint="Tracks tournaments"
                      selected={board?.slug === item.slug && board?.table_id === table.id}
                      onSelect={() => {
                        onLink(item.slug, table.id)
                        setOpen(false)
                      }}
                    />
                  ))
                })}
              </div>

              <button
                type="button"
                onClick={() => setMaking(true)}
                className="border-base-content/10 hover:bg-base-content/8 mt-1 flex w-full items-center gap-2 border-t px-2.5 py-2.5 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                New board…
              </button>
            </>
          )}

          {!making && (
            <p className="text-base-content/50 px-2.5 py-1.5 text-xs">
              Linking adds every player and counts everything played so far.
            </p>
          )}

          {error && <p className="text-error px-2.5 pb-1.5 text-xs">{error}</p>}
        </div>
      )}
    </div>
  )
}
