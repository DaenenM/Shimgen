const FORMATS = [
  { value: 'single', label: 'Single elimination', hint: 'One loss and you are out.' },
  { value: 'double', label: 'Double elimination', hint: 'Losers bracket, second chance.' },
  { value: 'rr', label: 'Round robin', hint: 'Everyone plays everyone.' },
  { value: 'swiss', label: 'Swiss', hint: 'Paired on score, nobody eliminated.' },
]

/**
 * The format chooser.
 *
 * One row per option with the explanation shown only for the chosen one. Four
 * cards each carrying a permanent subtitle cost about 350px — a third of the
 * viewport — to describe formats the host was not picking.
 */
export function FormatPicker({ value, onChange }) {
  return (
    <div>
      <span className="text-sm font-medium">Format</span>
      {/* Individual rounded rows rather than a bordered box of them.
        A single `glass-inset` frame divided by hairlines reads as a
        table — the shape a settings list had a decade ago — where
        every other chooser on the site (the board picker, the
        permissions list, the mobile sheet) gives each option its own
        rounded surface and tints the chosen one. */}
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
            {/* The browser's own radio chrome, which `accent-primary`
              only tints, draws a ring around a smaller inner dot —
              two concentric circles that read as a form control from
              a decade ago. `appearance-none` takes that away so the
              indicator can be a single solid dot.

              Still a real <input>: it keeps the radiogroup semantics
              and arrow-key navigation the native control provides,
              which a styled <div> would have to reimplement. The
              focus ring is put back by hand, because `appearance-none`
              removes that too. */}
            <input
              type="radio"
              name="format"
              // One solid blue dot. `appearance-none` drops the
              // browser's own chrome; the 1px border then only marks
              // the empty state, and goes transparent when checked so
              // the fill has no ring sitting against it. Colouring that
              // border blue instead left a visible seam where the two
              // blues met, which is what read as a hard edge.
              //
              // The focus outline is put back by hand, because
              // `appearance-none` removes that too.
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
