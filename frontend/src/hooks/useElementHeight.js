import { useEffect, useState } from 'react'

/**
 * The live pixel height of an element, tracked as it changes.
 *
 * For the case where one box has to be no taller than another next to it, but
 * still free to be shorter. CSS cannot say that inside a grid row: the row's
 * height is derived from the items in it, so "as tall as my sibling" and "as
 * tall as my content" define each other in a circle. Measuring one side breaks
 * the loop.
 *
 * Returns null until the first measurement, so callers can render uncapped on
 * the first paint rather than guessing a height and shifting afterwards.
 */
export function useElementHeight(ref) {
  const [height, setHeight] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // `ResizeObserver` rather than a resize listener: the sibling changes
    // height when its own contents change — a rule added, a longer hint — not
    // only when the window does.
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return height
}
