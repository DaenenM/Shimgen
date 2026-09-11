import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'

const SITE_NAME = 'Shimgen'

/**
 * Keep the browser tab, and the page description, matched to the current route.
 *
 * Titles come from each route's `handle` rather than from the pages themselves,
 * so they sit next to the routes they describe and a new page cannot quietly
 * ship without one.
 *
 * A route may give a function instead of a string when the name depends on
 * loaded data, such as a tournament's own title. It receives the match, and
 * returning nothing falls back to the bare site name rather than rendering
 * "Shimgen | undefined".
 *
 * Every page reads "Shimgen | {page}". Marketing-length titles were tried here
 * and reverted: a tab strip with six tournaments open needs the page name
 * legible in ~20 characters, which a keyword-first headline cannot do.
 * Ranking copy lives in `handle.description` and in index.html instead.
 *
 * A caveat worth knowing: this runs in the browser, so it helps search engines
 * that execute JavaScript (Google does) but not link unfurlers that do not
 * (Discord, Slack). Those read the static tags in index.html.
 */
export function useDocumentTitle() {
  const matches = useMatches()

  // The deepest match wins: nested routes describe the page more precisely
  // than their parents do.
  const active = [...matches].reverse().find((match) => match.handle?.title)
  const handle = active?.handle

  const name = typeof handle?.title === 'function' ? handle.title(active) : handle?.title
  const description = handle?.description

  useEffect(() => {
    document.title = name ? `${SITE_NAME} | ${name}` : SITE_NAME
  }, [name])

  useEffect(() => {
    if (!description) return

    const tag = document.querySelector('meta[name="description"]')
    if (!tag) return

    const original = tag.getAttribute('content')
    tag.setAttribute('content', description)

    // Restored on the way out, so navigating away from a described page does
    // not leave its description attached to the next one.
    return () => tag.setAttribute('content', original)
  }, [description])
}
