/** The solid submit button the account forms share, with a spinner while busy. */
export function SubmitButton({ busy, children, className = '' }) {
  return (
    <button
      type="submit"
      className={`bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${className}`}
      disabled={busy}
    >
      {busy && <span className="loading loading-spinner loading-sm" />}
      {children}
    </button>
  )
}
