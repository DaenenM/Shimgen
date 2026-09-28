import { Check, Plus, Users, X } from '@/components/icons'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'

/**
 * Who else can add to this board.
 *
 * Owner-only, because an editor who could hand out access could hand it to
 * anyone — which would leave the owner's control over the board nominal.
 */
export function BoardPeople({ people, friends, onAdd, onRemove, error, onDeleteBoard, boardName }) {
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

        <ErrorAlert>{error}</ErrorAlert>

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
