// Placeholder shapes for content that hasn't loaded, sized close to the real
// content so layout doesn't jump when it lands. Used by pages while data fetches.

// One shimmering block; `className` sets its size.
function Skeleton({ className = '' }) {
  return <div className={`bg-base-300/60 animate-pulse rounded ${className}`} aria-hidden="true" />
}

// List of card-shaped placeholders. `count` should match the usual list size.
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

// Full detail-page placeholder (title bar + content) for pages whose header
// depends on data not loaded yet. `width` should match the real page's container.
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

// Placeholder rows for a table/tally, including a header line.
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
