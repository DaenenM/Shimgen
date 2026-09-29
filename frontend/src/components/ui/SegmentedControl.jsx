import { useLayoutEffect, useRef, useState } from 'react'

const SIZES = {
  sm: { track: 'h-9', option: 'px-3' },
  md: { track: 'h-9', option: 'px-4' },
}

// Row of mutually exclusive options ("Solo / Teams / Captains"), styled to
// match Select. A sliding highlight marks the chosen option; keyboard works as
// a radiogroup (arrows move/choose, Home/End jump to ends).
// `options`: [value, label] pairs, or [value, label, shortLabel] for `block`
// mode, where shortLabel shows once the track is under 24rem (phone widths).
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

  // Skip the animation on first placement, so it doesn't sweep in on load.
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
