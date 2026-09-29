import { Check, Settings2 } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { paths } from '@/routes/paths'

import { InlineName } from './InlineName'

// Board name, description, share link and edit toggle. Used by BoardPage.jsx.
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
          // Renaming the board is owner-only, unlike tallying.
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
        {/* Built from board name/slug, not the URL, so it works from a bare slug too. */}
        <CopyLinkButton url={`${window.location.origin}${paths.board(board.slug, board.name)}`} />

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
