// On/off switch (label left, sliding switch right). Real checkbox underneath
// with role="switch" for native keyboard/focus/label behavior.
// `icon`: glyph on the knob. `hideLabel`: hides the visible label (still
// read by screen readers) for tight headers where the icon suffices.
export function Toggle({
  label,
  checked,
  onChange,
  title,
  disabled = false,
  icon: Icon,
  hideLabel = false,
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed has-disabled:opacity-50 ${
        hideLabel ? 'shrink-0' : 'w-full justify-between'
      }`}
      title={title ?? (hideLabel ? label : undefined)}
    >
      <span className={hideLabel ? 'sr-only' : 'text-sm font-medium'}>{label}</span>

      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />

      <span
        aria-hidden="true"
        className="bg-base-content/20 peer-checked:bg-primary peer-focus-visible:outline-primary peer-checked:[&>span]:text-primary relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-checked:[&>span]:translate-x-5"
      >
        {/* transition on `translate` (not `transform`) — Tailwind's translate-x
            utilities set `translate` directly. Off-glyph uses a fixed grey since
            the theme's text colour is near-white and invisible on the white knob. */}
        <span className="absolute left-0.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[oklch(58%_0.02_260)] shadow-sm transition-[translate,color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
          {Icon && <Icon className="h-3 w-3" strokeWidth={2.5} />}
        </span>
      </span>
    </label>
  )
}
