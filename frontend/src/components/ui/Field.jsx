/**
 * Form controls, at one size.
 *
 * Inputs were written inline and ended up at three sizes with four different
 * corner radii — `input-sm rounded-lg` next to a default `input-bordered`, on
 * the same form. These wrap the DaisyUI classes so a control is described by
 * what it is rather than by how it should look.
 *
 * Everything here is at least 44px tall on touch, which is the smallest target
 * a thumb hits reliably. That is also why there is no `sm` size: a form filled
 * in on a phone at a table has no room for a control that needs aiming at.
 */

const CONTROL =
  'w-full rounded-lg border-base-300 bg-base-100 min-h-11 transition-colors ' +
  'focus:border-primary focus:outline-none'

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

export function TextInput({ className = '', ...rest }) {
  return <input className={`input input-bordered ${CONTROL} ${className}`} {...rest} />
}

export function TextArea({ className = '', rows = 4, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={`textarea textarea-bordered border-base-300 bg-base-100 focus:border-primary w-full rounded-lg transition-colors focus:outline-none ${className}`}
      {...rest}
    />
  )
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`select select-bordered ${CONTROL} ${className}`} {...rest}>
      {children}
    </select>
  )
}

/**
 * A group of mutually exclusive choices, as cards rather than radio dots.
 *
 * A native radio is a 16px target with its label alongside; this makes the
 * whole option tappable and gives each choice room for the sentence that says
 * what it means. `options` is `[{ value, label, hint }]`.
 */
export function ChoiceGroup({ name, value, onChange, options, columns = 2, className = '' }) {
  return (
    <div
      className={`grid gap-2 ${columns === 2 ? 'sm:grid-cols-2' : ''} ${className}`}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = value === option.value

        return (
          <label
            key={String(option.value)}
            className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
              selected
                ? 'border-primary bg-primary/5'
                : 'border-base-300 hover:border-base-content/20'
            }`}
          >
            <input
              type="radio"
              name={name}
              className="radio radio-primary radio-sm mt-0.5 shrink-0"
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.hint && (
                <span className="text-base-content/60 block text-xs">{option.hint}</span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
