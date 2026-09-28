/**
 * An on/off setting: its name on the left, a sliding switch on the right.
 *
 * A switch rather than a checkbox because these settings take effect as a
 * state of the thing being built ("there is a 3rd-place match") rather than a
 * box ticked on a form. Still a real checkbox underneath — `role="switch"` so
 * it is announced as one, and the keyboard, focus and label click all come
 * from the native control rather than being rebuilt.
 *
 * `title` is optional hover text for a setting whose name needs a gloss.
 *
 * `icon` puts a glyph on the knob, and `hideLabel` drops the visible name
 * (it is still read out) — for a switch in a tight header, where the icon
 * says what it is. The glyph takes the track's blue when on and greys out
 * when off, so the state reads from the knob alone.
 */
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

      {/* The track fills with the interactive blue when on; the knob slides
          with a slight overshoot so the change reads as a physical flick
          rather than a jump. */}
      <span
        aria-hidden="true"
        className="bg-base-content/20 peer-checked:bg-primary peer-focus-visible:outline-primary peer-checked:[&>span]:text-primary relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-checked:[&>span]:translate-x-5"
      >
        {/* `translate` in the transition, not `transform`: Tailwind's
            translate-x utilities set the standalone `translate` property, so a
            transition limited to `transform` let the knob jump rather than
            slide. The off-state glyph is a fixed grey rather than a shade of
            the theme's text colour, which is near-white in the dark theme and
            vanished against the white knob. */}
        <span className="absolute left-0.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[oklch(58%_0.02_260)] shadow-sm transition-[translate,color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
          {Icon && <Icon className="h-3 w-3" strokeWidth={2.5} />}
        </span>
      </span>
    </label>
  )
}
