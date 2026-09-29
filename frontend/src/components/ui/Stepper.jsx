import { Minus, Plus } from '@/components/icons'

// Number stepper between min/max. `onChange` receives an updater function, so
// rapid taps don't overwrite each other. Used by CaptainSettings.jsx and TeamCountStepper.jsx.
export function Stepper({ value, min, max, onChange, lessLabel, moreLabel }) {
  return (
    <div className="glass-raised flex shrink-0 items-center overflow-hidden">
      <button
        type="button"
        onClick={() => onChange((n) => Math.max(min, n - 1))}
        disabled={value <= min}
        aria-label={lessLabel}
        className="hover:text-primary grid h-9 w-9 place-items-center rounded-l-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>

      <span className="tabular w-10 text-center text-lg font-bold">{value}</span>

      <button
        type="button"
        onClick={() => onChange((n) => Math.min(max, n + 1))}
        disabled={value >= max}
        aria-label={moreLabel}
        className="hover:text-primary grid h-9 w-9 place-items-center rounded-r-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
