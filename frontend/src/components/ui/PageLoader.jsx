/** Full-height loading state, used by route guards and lazy-route fallbacks. */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="loading loading-spinner loading-lg text-primary" />
        <span className="text-base-content/60 text-sm">{label}</span>
      </div>
    </div>
  )
}
