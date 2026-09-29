const FORMATS = [
  { value: 'single', label: 'Single elimination', hint: 'One loss and you are out.' },
  { value: 'double', label: 'Double elimination', hint: 'Losers bracket, second chance.' },
  { value: 'rr', label: 'Round robin', hint: 'Everyone plays everyone.' },
  { value: 'swiss', label: 'Swiss', hint: 'Paired on score, nobody eliminated.' },
]

// Format chooser: one row per option, hint text shown only for the selected one.
// Used by SettingsPanel.jsx.
export function FormatPicker({ value, onChange }) {
  return (
    <div>
      <span className="text-sm font-medium">Format</span>
      {/* Individual rounded rows, matching the style of other choosers on the site. */}
      <div className="mt-2 flex flex-col gap-1">
        {FORMATS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 ${
              value === option.value
                ? 'border-primary/40 bg-primary/12 shadow-primary/10 border shadow-sm'
                : 'glass-inset hover:border-base-content/25 hover:bg-base-content/5'
            }`}
          >
            {/* Real <input> for radiogroup semantics and keyboard nav; appearance-none
                strips native chrome for a single solid dot instead of concentric circles. */}
            <input
              type="radio"
              name="format"
              // appearance-none removes native chrome (and the focus ring, restored via focus-visible below).
              className="border-base-content/30 checked:bg-primary focus-visible:outline-primary h-3.5 w-3.5 shrink-0 appearance-none rounded-full border transition-all duration-200 checked:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span
              className={`text-sm transition-colors duration-200 ${
                value === option.value ? 'text-primary font-semibold' : 'font-medium'
              }`}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>

      <p className="text-base-content/50 mt-1.5 text-xs">
        {FORMATS.find((option) => option.value === value)?.hint}
      </p>
    </div>
  )
}
