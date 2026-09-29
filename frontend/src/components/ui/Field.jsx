/**
 * A labelled control.
 *
 * The label is a real `<label>` wrapping its input, so tapping the text focuses
 * the field — which on a phone is a much bigger target than the input itself.
 */
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
