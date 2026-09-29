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
            className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors duration-150 ${
              selected
                ? 'border-primary/50 bg-primary/10'
                : 'glass-inset hover:border-base-content/25 hover:bg-base-content/5'
            }`}
          >
            <input
              type="radio"
              name={name}
              className="accent-primary mt-0.5 h-4 w-4 shrink-0"
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
