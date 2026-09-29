import { createContext } from 'react'

/*
 * The drag state `TeamDragProvider` shares with the team cards, kept out of the
 * component files so fast refresh can reload those on their own.
 */

// Draggable ids carry their kind, so one handler can tell a player from the
// team card it was dropped on.
export const memberId = (key) => `m:${key}`
export const teamId = (index) => `team:${index}`
export const keyOf = (id) => String(id).slice(2)
export const isMember = (id) => String(id).startsWith('m:')

/** The key in the air, and the team the pointer is over. */
export const DragState = createContext({ dragging: null, overGroup: null })
