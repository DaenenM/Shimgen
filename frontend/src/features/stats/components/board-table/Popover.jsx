import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Small menu hung off a trigger button, rendered in a portal on document.body.
// Used by ColumnEditor.jsx and SwapRow.jsx.
// Portal avoids clipping: absolute is clipped by the table scroller, and fixed still
// stacks inside `.glass-panel` because its backdrop-filter creates a containing block.
// Position is measured (not inferred from row index) so it stays correct after scrolling.
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
        // Clamped so a trigger near the right edge doesn't hang the panel off screen.
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
    // Capture phase so scrolling inside the table's own scroller also dismisses.
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
