import { useDroppable } from '@dnd-kit/core'
import { useContext } from 'react'

import { DragState, teamId } from '../context/dragState'

// Makes a team card a drop target (whole card, not just its rows, so an empty team can receive a drop).
// Used by GeneratedTeamCard.jsx and BuilderTeamCard.jsx.
// `highlight`: outlined blue + tinted while a name is over it, otherwise outlined in `restColor`.
export function useTeamDropTarget(index, restColor = 'transparent') {
  const { dragging, overGroup } = useContext(DragState)
  const { setNodeRef } = useDroppable({ id: teamId(index) })
  const isTarget = dragging != null && overGroup === index

  return {
    ref: setNodeRef,
    isTarget,
    dragging: dragging != null,
    highlight: {
      className: `outline-offset-2 transition-[outline-color,background-color] duration-200 ease-out ${
        isTarget ? 'bg-primary/8' : ''
      }`,
      style: {
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineColor: isTarget ? 'var(--color-primary)' : restColor,
      },
    },
  }
}
