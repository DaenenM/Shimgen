// Inline error shown next to what failed (a form, a list). For failures with
// no natural spot on screen, use Toaster instead. Renders nothing if empty.
export function ErrorAlert({ children, compact = false, className = '' }) {
  if (!children) return null

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
