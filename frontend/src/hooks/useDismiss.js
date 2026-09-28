import { useEffect, useRef } from 'react'

/**
 * Close a popover on a click outside it or on Escape.
 *
 * Every popover on the site dismisses the same way, and each used to carry its
 * own copy of these listeners. Attached only while `open`, so a closed menu
 * costs nothing.
 *
 * `refs` is one ref or several: a popover portalled to <body> is not inside
 * its trigger, so a click on either has to count as inside.
 */
export function useDismiss(refs, open, onDismiss) {
  // Both read through refs, so an inline `() => setOpen(false)` or `[a, b]`
  // does not re-attach the listeners on every render.
  const dismiss = useRef(onDismiss)
  const inside = useRef(refs)
  useEffect(() => {
    dismiss.current = onDismiss
    inside.current = refs
  })

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      const all = Array.isArray(inside.current) ? inside.current : [inside.current]
      if (!all.some((ref) => ref.current?.contains(event.target))) dismiss.current()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismiss.current()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])
}
