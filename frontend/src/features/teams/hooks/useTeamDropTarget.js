import { useDroppable } from '@dnd-kit/core'
import { useContext } from 'react'

import { DragState, teamId } from '../context/dragState'

/**
 * Make a team card a drop target.
 *
 * The whole card accepts a drop, not only its rows — otherwise an empty team
 * could never receive anyone. `highlight` is the card's drop-target styling:
 * outlined in the interactive blue and faintly tinted while a name is over it,
 * or outlined in `restColor` otherwise (transparent unless the page marks a
 * card, as the form does its target team).
 */
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
