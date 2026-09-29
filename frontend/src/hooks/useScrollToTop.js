// Scrolls to the top on route change, since a SPA otherwise keeps the old
// scroll position. Skips back/forward navigation (POP) so returning to a list
// keeps your place, and ignores search-param-only changes (filters, tabs).

import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function useScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) // no animation
  }, [pathname, navigationType])
}
