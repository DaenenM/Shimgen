import { createContext } from 'react'

// Drag state shared by TeamDragProvider with the team card components.
// Kept out of component files so fast refresh can reload those independently.

// Draggable ids are prefixed by kind, so one handler can tell player rows from team cards.
export const memberId = (key) => `m:${key}`
export const teamId = (index) => `team:${index}`
export const keyOf = (id) => String(id).slice(2)
export const isMember = (id) => String(id).startsWith('m:')

// Key currently being dragged, and the team the pointer is over.
export const DragState = createContext({ dragging: null, overGroup: null })
