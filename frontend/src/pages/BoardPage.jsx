import { ArrowLeft, Check, Settings2, Users } from '@/components/icons'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { AddTable } from '@/features/stats/AddTable'
import { BoardPeople } from '@/features/stats/BoardPeople'
import { InlineName } from '@/features/stats/InlineName'
import { TableCard } from '@/features/stats/TableCard'
import { useBoard } from '@/features/stats/useBoard'
import { useRoster } from '@/hooks/useRoster'
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
  const { players: roster } = useRoster()
  const { board, isLoading, friends, busyKey, actions, addingTable, addPersonError } =
    useBoard(slug)
  const [editing, setEditing] = useState(false)

  if (isLoading) return <SkeletonPage width="max-w-5xl" />

  if (!board) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">No such board</h1>
        <Button to={paths.stats} className="mt-4">
          Back to stats
        </Button>
      </div>
    )
  }

  const canEdit = board.role === 'owner' || board.role === 'editor'
  const isOwner = board.role === 'owner'

  return (
    <PageShell className="glass-backdrop">
      {/* The frame animates, not the tables. A board's rows and tallies change
          on every mark added, and a tally that re-animates as it is counted
          would be unusable. */}
      <Link
        to={paths.stats}
        className="text-base-content/60 hover:text-base-content rise-in rise-delay-1 mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All boards
      </Link>

      <div className="rise-in rise-delay-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {editing && isOwner ? (
            // Owner only, like every other structural change — an editor may
            // tally all night without being able to reshape what everyone's
            // history lives under.
            <InlineName
              name={board.name}
              onRename={actions.renameBoard}
              label="Board name"
              className="h-11 w-full max-w-sm text-2xl font-bold tracking-tight sm:text-3xl"
            />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{board.name}</h1>
          )}
          {board.description && (
            <p className="text-base-content/60 mt-1 text-sm">{board.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Built from the board rather than read off the address bar, so the
              copied link carries the name even when this page was reached by
              the bare slug. */}
          <CopyLinkButton url={`${window.location.origin}${paths.board(board.slug, board.name)}`} />

          {/* Solid while editing, glass at rest. "Done" is the way out of a
              state the board is currently in, so it gets the page's one opaque
              treatment, while "Edit" is just another header control. */}
          {canEdit && (
            <Button
              variant={editing ? 'primary' : 'secondary'}
              size="sm"
              icon={editing ? Check : Settings2}
              onClick={() => setEditing((on) => !on)}
            >
              {editing ? 'Done' : 'Edit'}
            </Button>
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
            above={board.tables[index - 1]}
            below={board.tables[index + 1]}
            canEdit={canEdit}
            editing={editing}
            roster={roster}
            busyKey={busyKey}
            actions={actions}
          />
        ))}
      </div>

      {editing && <AddTable onAdd={actions.addTable} pending={addingTable} />}

      {editing && isOwner && (
        <BoardPeople
          people={board.people}
          friends={friends}
          onAdd={actions.addPerson}
          onRemove={actions.removePerson}
          error={addPersonError}
          onDeleteBoard={actions.removeBoard}
          boardName={board.name}
        />
      )}
    </PageShell>
  )
}
