// Wraps a form control in a real <label> (so tapping the text focuses it) plus
// an optional hint or error line. Used by NewBoardForm.jsx and other forms.
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`flex w-full flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm font-medium">{label}</span>}
      {children}
      {error ? (
        <span className="text-error text-xs">{error}</span>
      ) : (
        hint && <span className="text-base-content/60 text-xs">{hint}</span>
      )}
    </label>
  )
}
