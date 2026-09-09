import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Start every new page at the top.
 *
 * A single-page app keeps the window's scroll position across navigations, so
 * clicking a link from halfway down a long bracket used to drop you into the
 * middle of the next page — usually past its heading, occasionally past the
 * whole of its content.
 *
 * Back and forward are deliberately excluded: returning to a list should put
 * you where you were reading, not at the top of it. `useNavigationType` reports
 * POP for those, which is the browser restoring history rather than a fresh
 * navigation.
 *
 * Keyed on pathname only. Search params change when a filter or tab is applied
 * in place, and yanking the page to the top for those would feel like a
 * glitch rather than a navigation.
 */
export function useScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return

    // 'instant' rather than smooth: this is not a scroll the user asked for,
    // and animating it means watching the previous page slide away first.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, navigationType])
}
