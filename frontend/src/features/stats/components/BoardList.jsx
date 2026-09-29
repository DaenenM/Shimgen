import { Table2 } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLoader } from '@/components/ui/SectionLoader'

import { BoardListItem } from './BoardListItem'

/** The signed-in user's boards, or the prompt to make the first. */
export function BoardList({ boards, isLoading, creating, onCreate, onFavourite, onDelete }) {
  // Only the list waits. The header and its "New board" button are above and
  // already interactive, so the page is usable before the fetch lands.
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
    // A list rather than a grid of cards. Boards are a short, scanned list —
    // you are looking for one name — and a single column keeps every name on
    // the same left edge instead of making the eye zigzag.
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
