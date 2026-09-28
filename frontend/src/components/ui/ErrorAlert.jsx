/**
 * An inline error, for a failure that belongs next to the thing that failed.
 *
 * The toast (see `Toaster`) covers failures with no natural place on screen;
 * this is for the ones that do — a form that did not submit, a list that did
 * not load. Renders nothing without a message, so callers can pass
 * `mutation.error?.message` straight in.
 */
export function ErrorAlert({ children, compact = false, className = '' }) {
  if (!children) return null

  // Sizes are chosen here rather than overridden by callers: two text sizes on
  // one element resolve by stylesheet order, not by which was written last.
  const size = compact ? 'rounded-lg text-xs' : 'rounded-xl text-sm'

  return (
    <div
      role="alert"
      className={`border-error/30 bg-error/12 text-error border px-3 py-2 ${size} ${className}`}
    >
      {children}
    </div>
  )
}
