/**
 * A labelled text field on the sign-in, sign-up and profile forms.
 *
 * `error` swaps the hint for the server's message and reddens the edge, so a
 * field says what is wrong with it where the eye already is.
 */
export function AuthField({ label, optional = false, hint, error, className = '', ...input }) {
  return (
    <label className="form-control">
      <span className="label-text mb-1">
        {label}
        {optional && <span className="text-base-content/40"> (optional)</span>}
      </span>
      <input
        className={`glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 w-full px-3 text-sm transition-colors focus:outline-none disabled:opacity-50 ${
          error ? 'border-error/60' : ''
        } ${className}`}
        {...input}
      />
      {error ? (
        <span className="text-error mt-1 text-xs">{error}</span>
      ) : (
        hint && <span className="text-base-content/50 mt-1 text-xs">{hint}</span>
      )}
    </label>
  )
}
