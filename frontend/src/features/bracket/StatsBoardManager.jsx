import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Check, ChevronDown, Plus } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

import { boards as boardsApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

/**
 * Change which stats board a running tournament feeds.
 *
 * The board is picked on the new-tournament form, which is exactly when a host
 * is least likely to be thinking about it — the bracket is what they came for.
 * That made the first choice final: a night that should have counted towards
 * the league simply did not, and the only way to fix it was to run it again.
 *
 * Linking here catches up on whatever has already been played, so a board
 * attached halfway through the night still shows the whole night.
 *
 * Host-only, and signed-in only: a board is something an account owns, and an
 * anonymous quick-start bracket has none to attach to.
 */
export function StatsBoardManager({ board, onLink, pending, error }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [making, setMaking] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const container = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Only asked for once the menu is open: a bracket page should not fetch a
  // board list nobody has looked at.
  const { data } = useQuery({
    queryKey: queryKeys.boards.all,
    queryFn: boardsApi.list,
    enabled: open,
  })

  // Only boards the host may write to, and only boards built to receive a
  // tournament. Linking writes onto someone else's record, so offering one they
  // cannot edit would be an error waiting to be refused — and linking a
  // hand-counted board would restructure it, adding the four columns a bracket
  // fills to a table made for counting by hand.
  const editable = (data?.results ?? data ?? []).filter(
    (item) => (item.role === 'owner' || item.role === 'editor') && item.tracks_tournaments,
  )

  /**
   * Make a board without leaving the bracket.
   *
   * Always a tournament board: it exists to receive this bracket's results, so
   * the kind is not a question worth interrupting for.
   */
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
        // The board's name rather than "Stats board": what a host wants to know
        // at a glance is whether tonight is being counted, and where.
        title={board ? `Counting towards ${board.name}` : 'This tournament is not being counted'}
        className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 max-w-[8.5rem] items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:max-w-[13rem]"
        disabled={pending}
      >
        <BarChart3 className={`h-4 w-4 shrink-0 ${board ? 'text-primary' : ''}`} />
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
                <Option
                  label="Not counted"
                  hint="This night stays off every board"
                  selected={!board}
                  onSelect={() => {
                    onLink('')
                    setOpen(false)
                  }}
                />

                {editable.map((item) => (
                  <Option
                    key={item.slug}
                    label={item.name}
                    hint="Tracks tournaments"
                    selected={board?.slug === item.slug}
                    onSelect={() => {
                      onLink(item.slug)
                      setOpen(false)
                    }}
                  />
                ))}
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

          {/* Said here rather than in a tooltip: a host linking a board
              mid-tournament is usually worried they have missed the results
              already reported. */}
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

function Option({ label, hint, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-primary/12' : 'hover:bg-base-content/8'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${selected ? 'text-primary' : ''}`}>
          {label}
        </span>
        <span className="text-base-content/50 block truncate text-xs">{hint}</span>
      </span>

      {selected && <Check className="text-primary h-4 w-4 shrink-0" />}
    </button>
  )
}
