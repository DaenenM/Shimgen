import { Table2 } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLoader } from '@/components/ui/SectionLoader'

import { BoardListItem } from './BoardListItem'

// Signed-in user's boards, or a prompt to create the first. Used by StatsPage.jsx.
export function BoardList({ boards, isLoading, creating, onCreate, onFavourite, onDelete }) {
  // Only the list itself waits; header controls above stay interactive.
  if (isLoading) return <SectionLoader label="Loading your boards…" />

  if (boards.length === 0 && !creating) {
    return (
      <EmptyState
        icon={Table2}
        title="No boards yet"
        description="A board is a list of names and the things you count for them: solo wins, team wins, whatever your crew argues about."
        actionLabel="Create a board"
        onAction={onCreate}
      />
    )
  }

  return (
    <ul className="glass-panel divide-base-content/8 divide-y overflow-hidden">
      {boards.map((board) => (
        <BoardListItem
          key={board.slug}
          board={board}
          onFavourite={() => onFavourite(board.slug)}
          onDelete={() => onDelete(board)}
        />
      ))}
    </ul>
  )
}
