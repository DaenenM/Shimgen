import { useDroppable } from '@dnd-kit/core'
import { createContext, useContext } from 'react'

/*
 * The drag state `TeamDrag` shares with the team cards, kept out of the
 * component file so fast refresh can reload that file on its own.
 */

// Draggable ids carry their kind, so one handler can tell a player from the
// team card it was dropped on.
export const memberId = (key) => `m:${key}`
export const teamId = (index) => `team:${index}`
export const keyOf = (id) => String(id).slice(2)
export const isMember = (id) => String(id).startsWith('m:')

/** The key in the air, and the team the pointer is over. */
export const DragState = createContext({ dragging: null, overGroup: null })

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
