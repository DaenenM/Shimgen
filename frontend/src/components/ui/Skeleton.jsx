/**
 * Placeholder shapes for content that has not arrived yet.
 *
 * These exist so a page can paint its header, nav and actions immediately and
 * show the wait only where the data actually goes. Replacing a whole page with
 * a spinner reads as slower than it is: the user sees nothing they can act on,
 * even though most of the page never depended on the server.
 *
 * The shapes are deliberately close to the real content's size, so the layout
 * does not jump when data lands.
 */

/** One shimmering block. `className` sets its size. */
export function Skeleton({ className = '' }) {
  return <div className={`bg-base-300/60 animate-pulse rounded ${className}`} aria-hidden="true" />
}

/**
 * A list of card-shaped placeholders.
 *
 * `count` should match what the page usually shows, so the scrollbar does not
 * lurch when the real rows replace these.
 */
export function SkeletonCards({ count = 3, className = '' }) {
  return (
    <div className={`grid gap-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card bg-base-100 border-base-300 border">
          <div className="card-body gap-3 py-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A whole detail page, waiting.
 *
 * Detail pages name themselves from data they have not got yet — a group's
 * name, a tournament's title — so unlike a list page there is no static header
 * to paint first. What this buys instead is shape: the title bar and content
 * sit where the real ones will, so the page does not jump when data lands, and
 * the surrounding layout stays put throughout.
 *
 * `width` should match the page's own container so the placeholder does not
 * settle at a different width than the content replacing it.
 */
export function SkeletonPage({ width = 'max-w-4xl', children }) {
  return (
    <div className={`mx-auto ${width} px-4 py-8`} role="status" aria-label="Loading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {children ?? <SkeletonCards count={3} />}
    </div>
  )
}

/** Placeholder rows for a table or tally, including a header line. */
export function SkeletonRows({ count = 5, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-label="Loading">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
