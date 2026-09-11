/**
 * A spinner for one region of a page that is still waiting on the server.
 *
 * Distinct from `PageLoader`, which replaces a whole screen and is right only
 * when there is genuinely no page yet — a route still downloading, an auth
 * check that has not resolved. This one is for a page that has already painted
 * its header and actions and is waiting on the part that needs data.
 *
 * Sized to hold roughly the space the content will take, so the footer does not
 * jump up and then back down as rows arrive.
 */
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
