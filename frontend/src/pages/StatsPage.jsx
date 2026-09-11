import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Plus, Star, Table2, Trash2, Users, Zap } from '@/components/icons'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { boards as boardsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChoiceGroup, Field, TextInput } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * The boards a crew keeps.
 *
 * Most of a game night never becomes a bracket — someone wins a round of Pummel
 * Party and a name gets another emoji (plan §3). A board is where that lives,
 * and it is deliberately the crew's own shape: they name the tables, the
 * columns, and the mark that gets stamped.
 */
export function StatsPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  // Decides the board's first table: a hand-counted tally, or the four columns
  // a linked bracket fills in by itself.
  const [tracks, setTracks] = useState(false)

  // The board awaiting confirmation, held whole so the dialog can name it.
  // Deleting takes every tally on it, which is worth a real pause.
  const [confirming, setConfirming] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.boards.all,
    queryFn: boardsApi.list,
    enabled: isAuthenticated,
    // Boards move without this tab doing anything: a co-host reports a result
    // from their own phone and the tally changes. The bracket page invalidates
    // this cache after its own reports, but it cannot know about anyone else's,
    // so arriving here always asks. `placeholderData` keeps the cached board on
    // screen while it does, so this costs a background request rather than a
    // spinner.
    staleTime: 0,
  })

  const remove = useMutation({
    mutationFn: (slug) => boardsApi.remove(slug),
    onSuccess: () => {
      setConfirming(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
    },
  })

  const favourite = useMutation({
    mutationFn: (slug) => boardsApi.favourite(slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.boards.all }),
  })

  const create = useMutation({
    mutationFn: () => boardsApi.create({ name: name.trim(), tracks_tournaments: tracks }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
      navigate(paths.board(board.slug, board.name))
    },
  })

  if (!isAuthenticated) {
    return (
      <PageShell className="glass-backdrop">
        <PageHeader title="Stats" />
        <EmptyState
          icon={BarChart3}
          title="Stats need an account"
          description="A board keeps its tally between game nights, so it needs somewhere to live. Anyone you share the link with can see it without signing up."
          actionLabel="Create an account"
          actionTo={paths.register}
        />
      </PageShell>
    )
  }

  const available = data?.results ?? data ?? []

  return (
    <PageShell className="glass-backdrop">
      <PageHeader
        title="Stats"
        description="Tally boards for the nights that never became a bracket."
      >
        {!creating && (
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New board
          </Button>
        )}
      </PageHeader>

      {remove.isError && (
        <div
          role="alert"
          className="border-error/30 bg-error/12 text-error mb-4 rounded-xl border px-3 py-2 text-sm"
        >
          {remove.error.message}
        </div>
      )}

      {creating && (
        <Card padding="lg" className="mb-6 space-y-4">
          <Field label="Board name">
            <TextInput
              placeholder="Game Night Wins"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) create.mutate()
                if (e.key === 'Escape') setCreating(false)
              }}
            />
          </Field>

          <div className="space-y-2">
            <span className="text-sm font-medium">What is it counting?</span>
            <ChoiceGroup
              name="board-kind"
              value={tracks}
              onChange={setTracks}
              options={[
                {
                  value: false,
                  label: 'Counted by hand',
                  hint: 'You add each win yourself. The game night that never became a bracket.',
                },
                {
                  value: true,
                  label: 'From tournaments',
                  hint: 'Games played, wins, losses and tournament wins, kept up to date by linked brackets.',
                },
              ]}
            />
          </div>

          {create.isError && (
            <div
              role="alert"
              className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
            >
              {create.error.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              icon={Plus}
              disabled={!name.trim()}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              Create board
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false)
                setName('')
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        // Only the list waits. The header and its "New board" button are above
        // and already interactive, so the page is usable before the fetch lands.
        <SectionLoader label="Loading your boards…" />
      ) : available.length === 0 && !creating ? (
        <EmptyState
          icon={Table2}
          title="No boards yet"
          description="A board is a list of names and the things you count for them: solo wins, team wins, whatever your crew argues about."
          actionLabel="Create a board"
          onAction={() => setCreating(true)}
        />
      ) : (
        // A list rather than a grid of cards. Boards are a short, scanned
        // list — you are looking for one name — and a single column keeps every
        // name on the same left edge instead of making the eye zigzag.
        <ul className="glass-panel divide-base-content/8 divide-y overflow-hidden">
          {available.map((board) => (
            <li
              key={board.slug}
              className="group hover:bg-base-content/5 relative flex items-center gap-3 px-4 py-3.5 transition-colors duration-150"
            >
              {/* Pinned boards carry a coloured edge, so the ones you chose are
                  findable without reading a single row. */}
              {board.favourited_at && (
                <span
                  className="bg-warning absolute inset-y-0 left-0 w-1 first:rounded-tl-[1.25rem] last:rounded-bl-[1.25rem]"
                  aria-hidden="true"
                />
              )}

              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-bold ${
                  board.tracks_tournaments
                    ? 'bg-primary/15 text-primary'
                    : 'bg-base-content/8 text-base-content/50'
                }`}
                aria-hidden="true"
              >
                {board.name.slice(0, 1).toUpperCase()}
              </span>

              {/* The link covers the row's own area rather than wrapping it, so
                  the buttons can sit alongside — a button nested in an anchor is
                  invalid and swallows its own clicks. */}
              <Link to={paths.board(board.slug, board.name)} className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{board.name}</span>

                  {board.role !== 'owner' && (
                    <span className="bg-base-content/8 text-base-content/60 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
                      Shared
                    </span>
                  )}
                </span>

                <span className="text-base-content/50 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span>
                    {board.player_count} {board.player_count === 1 ? 'player' : 'players'}
                  </span>
                  <span>
                    {board.table_count} {board.table_count === 1 ? 'table' : 'tables'}
                  </span>
                  {board.tracks_tournaments && (
                    <span className="text-primary/70 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Tracks tournaments
                    </span>
                  )}
                  {board.editor_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {board.editor_count}
                    </span>
                  )}
                </span>
              </Link>

              <button
                onClick={() => favourite.mutate(board.slug)}
                aria-label={
                  board.favourited_at ? `Unpin ${board.name}` : `Pin ${board.name} to the top`
                }
                title={board.favourited_at ? 'Unpin' : 'Pin to the top'}
                // A pinned board keeps its star visible; an unpinned one shows
                // it on hover, so the list reads as boards rather than a column
                // of stars.
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-150 focus-visible:opacity-100 ${
                  board.favourited_at
                    ? 'text-warning hover:bg-base-content/5 opacity-100'
                    : 'text-base-content/40 hover:text-warning hover:bg-base-content/5 opacity-0 group-hover:opacity-100'
                }`}
              >
                <Star className="h-4 w-4" fill={board.favourited_at ? 'currentColor' : 'none'} />
              </button>

              {board.role === 'owner' && (
                <button
                  onClick={() => setConfirming(board)}
                  aria-label={`Delete ${board.name}`}
                  title="Delete board"
                  // Revealed on hover so the list reads as boards rather than a
                  // column of bins, but always reachable by keyboard.
                  className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-9 w-9 shrink-0 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete ${confirming?.name ?? 'this board'}?`}
        message="Every table, player and tally on it goes too. This cannot be undone."
        confirmLabel="Delete board"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirming.slug)}
        onCancel={() => setConfirming(null)}
      />
    </PageShell>
  )
}
