import { Check, Settings2 } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { paths } from '@/routes/paths'

import { InlineName } from './InlineName'

/** A board's name, description, share link and edit toggle. */
export function BoardHeader({
  board,
  canEdit,
  isOwner,
  editing,
  onToggleEditing,
  onRename,
  className = '',
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {editing && isOwner ? (
          // Owner only, like every other structural change — an editor may
          // tally all night without being able to reshape what everyone's
          // history lives under.
          <InlineName
            name={board.name}
            onRename={onRename}
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
            copied link carries the name even when this page was reached by the
            bare slug. */}
        <CopyLinkButton url={`${window.location.origin}${paths.board(board.slug, board.name)}`} />

        {/* Solid while editing, glass at rest. "Done" is the way out of a state
            the board is currently in, so it gets the page's one opaque
            treatment, while "Edit" is just another header control. */}
        {canEdit && (
          <Button
            variant={editing ? 'primary' : 'secondary'}
            size="sm"
            icon={editing ? Check : Settings2}
            onClick={onToggleEditing}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>
    </div>
  )
}
