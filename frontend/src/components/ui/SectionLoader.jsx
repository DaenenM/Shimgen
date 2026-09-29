// Spinner for one region of an already-rendered page (vs. PageLoader, which
// replaces the whole screen). Sized to roughly hold the space content will
// take, to avoid layout jump.
export function SectionLoader({ label = 'Loading…', className = '' }) {
  return (
    <div
      className={`border-base-300 bg-base-100/40 flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading loading-spinner loading-lg text-primary" />
      <span className="text-base-content/50 text-sm">{label}</span>
    </div>
  )
}
