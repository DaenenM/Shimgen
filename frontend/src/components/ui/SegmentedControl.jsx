import { useLayoutEffect, useRef, useState } from 'react'

const SIZES = {
  sm: { track: 'h-9', option: 'px-3' },
  md: { track: 'h-9', option: 'px-4' },
}

/**
 * A row of mutually exclusive options — "Keep apart / Keep together", "Solo /
 * Teams / Captains".
 *
 * Styled as the sibling of `Select`, because it is the same decision with the
 * options laid out instead of folded away: the same glass-inset track as the
 * dropdown's trigger, and the chosen option marked the way the dropdown marks
 * its selected row — a primary tint with primary text, not a solid fill.
 *
 * The highlight is one element that slides to the chosen option rather than
 * each button repainting, so a change reads as the marker moving across. It is
 * measured from the chosen button, so options of different widths need no
 * fixed grid, and re-measured when the track resizes. It appears without
 * sliding on first paint — there is nowhere for it to have come from.
 *
 * Keyboard: it is a radiogroup. Tab lands on the chosen option, the arrow keys
 * move and choose, Home and End jump to the ends.
 *
 * `options` is a list of `[value, label]` pairs. `block` stretches the track
 * to its container and shares the width equally, for a switcher that heads a
 * panel rather than sitting inline with other controls.
 *
 * A block track can also take `[value, label, shortLabel]`: the short one is
 * shown while the track is under 24rem, which on a phone is where three full
 * labels stop fitting and ran into each other. It keys off the track's own
 * width rather than the screen's, and only for `block` — an inline track sizes
 * to its content, so it cannot be a container without collapsing to nothing.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  size = 'md',
  block = false,
  className = '',
}) {
  const sizing = SIZES[size] ?? SIZES.md
  const track = useRef(null)
  const buttons = useRef([])
  const [marker, setMarker] = useState(null)
  const [animate, setAnimate] = useState(false)

  const index = options.findIndex(([optionValue]) => optionValue === value)

  useLayoutEffect(() => {
    const el = track.current
    if (!el) return

    function measure() {
      const button = buttons.current[index]
      setMarker(button ? { left: button.offsetLeft, width: button.offsetWidth } : null)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [index, options.length])

  // Only after the first placement, so the marker does not sweep in from the
  // left edge when the page loads.
  useLayoutEffect(() => {
    if (marker && !animate) {
      const frame = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [marker, animate])

  function choose(next) {
    const [nextValue] = options[next]
    onChange(nextValue)
    buttons.current[next]?.focus()
  }

  function onKeyDown(event) {
    const last = options.length - 1
    const moves = {
      ArrowRight: index >= last ? 0 : index + 1,
      ArrowDown: index >= last ? 0 : index + 1,
      ArrowLeft: index <= 0 ? last : index - 1,
      ArrowUp: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    choose(moves[event.key])
  }

  return (
    <div
      ref={track}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`glass-inset relative items-stretch gap-0.5 rounded-xl p-0.5 ${
        block ? '@container flex w-full' : 'inline-flex'
      } ${sizing.track} ${className}`}
    >
      {marker && (
        <span
          aria-hidden="true"
          className={`bg-primary/15 border-primary/30 pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-[0.625rem] border ${
            animate
              ? 'transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
              : ''
          }`}
          style={{ width: marker.width, transform: `translateX(${marker.left}px)` }}
        />
      )}

      {options.map(([optionValue, optionLabel, shortLabel], i) => {
        const selected = i === index

        return (
          <button
            key={String(optionValue)}
            ref={(node) => {
              buttons.current[i] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // With two labels in the DOM, one hidden by CSS, the name must be
            // pinned to the full one — not whichever the viewport happens to show.
            aria-label={block && shortLabel ? optionLabel : undefined}
            // Roving tabindex: one stop for the whole group, on the chosen
            // option; the arrows do the rest.
            tabIndex={selected || (index === -1 && i === 0) ? 0 : -1}
            onClick={() => choose(i)}
            className={`focus-visible:outline-primary relative z-[1] rounded-[0.625rem] font-semibold whitespace-nowrap ${
              // Equal cells centre their labels, so padding is only a floor
              // there — kept small so it is not what pushes a label to
              // truncate, which is the last resort below even the short one.
              // Under 20rem (the smallest phones) the text steps down too.
              block
                ? 'min-w-0 flex-1 truncate px-1 text-xs @xs:px-2 @xs:text-sm'
                : `${sizing.option} text-sm`
            } transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 ${selected ? 'text-primary' : 'text-base-content/60 hover:text-base-content'}`}
          >
            {block && shortLabel ? (
              <>
                <span className="@sm:hidden">{shortLabel}</span>
                <span className="hidden @sm:inline">{optionLabel}</span>
              </>
            ) : (
              optionLabel
            )}
          </button>
        )
      })}
    </div>
  )
}
