import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'

const SITE_NAME = 'Shimgen'

/**
 * Keep the browser tab named after the page you are on.
 *
 * Titles come from each route's `handle.title` rather than from the pages
 * themselves, so they sit next to the routes they describe and a new page
 * cannot quietly ship without one.
 *
 * A route may give a function instead of a string when the name depends on
 * loaded data — a tournament's own title, say. It receives the match, and
 * returning nothing falls back to the bare site name rather than rendering
 * "Shimgen | undefined".
 */
export function useDocumentTitle() {
  const matches = useMatches()

  // The deepest match wins: nested routes describe the page more precisely
  // than their parents do.
  const active = [...matches].reverse().find((match) => match.handle?.title)
  const handle = active?.handle?.title

  const name = typeof handle === 'function' ? handle(active) : handle

  useEffect(() => {
    document.title = name ? `${SITE_NAME} | ${name}` : SITE_NAME
  }, [name])
}
