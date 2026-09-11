/**
 * Click and drag the background of a scroller to pan it.
 *
 * A wide bracket or a wide table is a scroller, and reaching for a scrollbar to
 * read one is the kind of friction that makes a page feel like a document
 * rather than a tool. Grabbing the empty space between cards and pulling is what
 * people already do in every map and design canvas they use.
 *
 * Three rules keep it from breaking the things inside it, and each exists
 * because the naive version breaks exactly one of them:
 *
 *  - **A drag is only a drag past a threshold.** Reporting a result is a click
 *    on a team name, and a hand that moves two pixels while clicking is still
 *    clicking. Below the threshold nothing is intercepted at all.
 *  - **The click that ends a real drag is swallowed, once.** Without this,
 *    panning across a bracket and releasing over a card reports whoever happens
 *    to be under the cursor — a wrong result recorded by a navigation gesture.
 *  - **A drag never starts on a control.** Buttons, links and inputs keep their
 *    own behaviour whatever the pointer does afterwards, so a slightly shaky
 *    click on a name is a click on that name.
 *
 * Mouse only. Touch already has momentum scrolling that is better than anything
 * this could do, and a trackpad's two-finger scroll is untouched either way —
 * this adds a gesture rather than replacing one.
 */

import { useEffect, useRef } from 'react'

/** How far the pointer travels before this stops being a click. */
const THRESHOLD = 5

/** Controls that own their own pointer behaviour. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [contenteditable]'

export function useDragScroll() {
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Written to refs rather than state: these change on every pointermove, and
    // re-rendering a bracket sixty times a second to pan it would cost far more
    // than the panning is worth.
    let dragging = false
    let moved = false
    let startX = 0
    let startY = 0
    let scrollLeft = 0
    let scrollTop = 0

    const overflows = () =>
      element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight

    /** The grab cursor is a promise, so it is only made when panning is possible. */
    const showGrabCursor = () => {
      element.style.cursor = overflows() ? 'grab' : ''
    }

    const onPointerDown = (event) => {
      // Left button, mouse only. A right-click opens a menu and a middle-click
      // is the browser's own autoscroll; neither is ours to take.
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      if (!overflows()) return
      if (event.target.closest(INTERACTIVE)) return

      dragging = true
      moved = false
      startX = event.clientX
      startY = event.clientY
      scrollLeft = element.scrollLeft
      scrollTop = element.scrollTop
    }

    const onPointerMove = (event) => {
      if (!dragging) return

      const dx = event.clientX - startX
      const dy = event.clientY - startY

      if (!moved && Math.hypot(dx, dy) < THRESHOLD) return

      if (!moved) {
        moved = true
        element.style.cursor = 'grabbing'
        // Claimed only once the gesture is definitely a pan, so a plain click
        // never has its events redirected away from the control under it.
        element.setPointerCapture?.(event.pointerId)
        // Stops the browser selecting text across the cards being dragged over,
        // which is what made the old scrollbar-only version feel broken when
        // somebody tried this by instinct.
        element.style.userSelect = 'none'
      }

      element.scrollLeft = scrollLeft - dx
      element.scrollTop = scrollTop - dy
    }

    const endDrag = (event) => {
      if (!dragging) return

      dragging = false
      element.style.userSelect = ''
      showGrabCursor()

      if (!moved) return

      element.releasePointerCapture?.(event.pointerId)

      // Swallow the click this drag is about to produce — once, and only when
      // the pointer actually travelled. Capture phase, so it is gone before it
      // reaches the card underneath.
      const swallow = (click) => {
        click.stopPropagation()
        click.preventDefault()
      }
      element.addEventListener('click', swallow, { capture: true, once: true })

      // If no click follows (the pointer left the element, say), the listener
      // would sit there and eat the next genuine one. A frame is long enough
      // for the click to have fired and short enough to catch nothing else.
      requestAnimationFrame(() => {
        element.removeEventListener('click', swallow, { capture: true })
      })
    }

    showGrabCursor()

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', endDrag)
    element.addEventListener('pointercancel', endDrag)

    // The content can change size — a bracket gains a round, a board gains a
    // column — so whether panning is possible is re-asked rather than decided
    // once on mount.
    const observer = new ResizeObserver(showGrabCursor)
    observer.observe(element)

    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', endDrag)
      element.removeEventListener('pointercancel', endDrag)
      observer.disconnect()
      element.style.cursor = ''
      element.style.userSelect = ''
    }
  }, [])

  return ref
}
