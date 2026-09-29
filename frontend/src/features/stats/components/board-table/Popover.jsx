import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A small menu hung off a trigger button.
 *
 * Rendered in a portal on `document.body`, positioned from the trigger's own
 * rectangle.
 *
 * Neither absolute nor fixed works in place here, for two different reasons.
 * Absolute is clipped by the table's `overflow-x-auto` scroller. Fixed escapes
 * the scroller but not the card: `.glass-panel` sets `backdrop-filter`, and a
 * non-none backdrop-filter makes an element a containing block for fixed
 * descendants *and* opens a stacking context — so the panel was positioned
 * against the card and stacked inside it, which is why it appeared behind the
 * page rather than over it.
 *
 * A portal sidesteps both: the panel is a child of body, above every card, and
 * clipped by nothing.
 *
 * Flipped by measurement rather than by row index: whether there is room below
 * is a question about the viewport, and inferring it from "is this one of the
 * last two rows" is right only until the page is scrolled.
 *
 * Dismisses on any press outside it, on Escape, and on scroll — a panel pinned
 * to viewport coordinates would otherwise drift away from the row it belongs
 * to.
 *
 * The last measurement is left behind on close rather than cleared: the panel
 * renders only while open, so a stale coordinate is never drawn, and the next
 * open measures again before paint. Clearing it would be a setState in the
 * effect body for no visible benefit.
 */
export function Popover({ open, onOpenChange, label, title, icon, children }) {
  const trigger = useRef(null)
  const panel = useRef(null)
  const [place, setPlace] = useState(null)

  useEffect(() => {
    if (!open) return

    const WIDTH = 224
    const ESTIMATED = 260

    const locate = () => {
      const box = trigger.current?.getBoundingClientRect()
      if (!box) return

      const below = window.innerHeight - box.bottom

      setPlace({
        // Kept on screen horizontally too: a trigger near the right edge would
        // otherwise hang the panel off it.
        left: Math.min(Math.max(8, box.left), window.innerWidth - WIDTH - 8),
        ...(below < ESTIMATED && box.top > ESTIMATED
          ? { bottom: window.innerHeight - box.top + 6 }
          : { top: box.bottom + 6 }),
      })
    }

    locate()

    const dismiss = (event) => {
      if (panel.current?.contains(event.target)) return
      if (trigger.current?.contains(event.target)) return
      onOpenChange(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    const close = () => onOpenChange(false)

    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', onKeyDown)
    // Capture, so a scroll inside the table's own scroller counts as well.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', locate)

    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', locate)
    }
  }, [open, onOpenChange])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={label}
        title={title}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded transition-colors ${
          open
            ? 'text-primary bg-primary/10'
            : 'text-base-content/35 hover:text-primary hover:bg-primary/10'
        }`}
      >
        {icon}
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={panel}
            style={{ ...place, width: '14rem' }}
            className="glass-raised fixed z-[60] flex flex-col gap-0.5 p-1.5 normal-case shadow-xl"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
