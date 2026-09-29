import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Check, ChevronDown } from '@/components/icons'
import { useDismiss } from '@/hooks/useDismiss'

const SIZES = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3 text-sm',
}

// Space kept between the trigger and the list, and from the viewport's edge.
const GAP = 6
const MARGIN = 8

// The dropdown used everywhere on the site — a custom listbox since the
// native <select> can't be styled to match the glass UI.
// `options`: { value, label, disabled?, hint?, dot?, action? }. `dot` shows a
// colour swatch (e.g. a team colour); `action` marks a "+ New…" style entry.
// The list is portalled to <body> and positioned against the trigger, since
// rendering in place got clipped by ancestor `backdrop-filter`/scroll panels.
// Keyboard: arrows/Enter/Space open and move; Escape/Tab close.
export function Select({
  value,
  onChange,
  options,
  label,
  placeholder = 'Choose…',
  emptyText = 'Nothing to choose from.',
  size = 'md',
  disabled = false,
  onOpenChange,
  className = '',
  triggerClassName = '',
  triggerStyle,
}) {
  const [open, setOpen] = useState(false)
  // The option the keyboard is on, by index into `options`.
  const [active, setActive] = useState(-1)
  const [position, setPosition] = useState(null)

  const trigger = useRef(null)
  const list = useRef(null)
  const id = useId()

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = options[selectedIndex]
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((i) => i >= 0)

  useEffect(() => {
    onOpenChange?.(label, open)
  }, [open, onOpenChange, label])

  useDismiss([trigger, list], open, () => setOpen(false))

  // Positions the list below the trigger, or above if there's no room.
  // Recomputed on scroll/resize (capture phase, so scrolling inside a panel counts too).
  useLayoutEffect(() => {
    if (!open) return

    function place() {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return

      const below = window.innerHeight - rect.bottom - GAP - MARGIN
      const above = rect.top - GAP - MARGIN
      const flip = below < 160 && above > below

      setPosition({
        left: Math.min(rect.left, window.innerWidth - MARGIN - rect.width),
        minWidth: rect.width,
        maxHeight: Math.min(256, flip ? above : below),
        ...(flip ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)

    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Keep the keyboard's option in view as it moves through a long list.
  useEffect(() => {
    if (!open || active < 0) return
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function show() {
    if (disabled) return
    setActive(
      selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : (enabled[0] ?? -1),
    )
    setOpen(true)
  }

  function pick(index) {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }

  function step(delta) {
    if (enabled.length === 0) return
    const at = enabled.indexOf(active)
    const next = at === -1 ? 0 : (at + delta + enabled.length) % enabled.length
    setActive(enabled[next])
  }

  function onKeyDown(event) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        show()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        step(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        step(-1)
        break
      case 'Home':
        event.preventDefault()
        setActive(enabled[0] ?? -1)
        break
      case 'End':
        event.preventDefault()
        setActive(enabled[enabled.length - 1] ?? -1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        pick(active)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        aria-label={label}
        className={`glass-inset hover:border-base-content/25 flex w-full min-w-0 items-center justify-between gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-primary/50' : ''
        } ${SIZES[size] ?? SIZES.md} ${triggerClassName}`}
        style={triggerStyle}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.dot && <Dot color={selected.dot} />}
          <span className={`truncate ${selected ? '' : 'text-base-content/40'}`}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={`text-base-content/40 h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="glass-raised menu-in fixed z-[60] w-max max-w-[min(20rem,calc(100vw-1rem))] overflow-auto rounded-xl"
            style={position}
          >
            {options.length === 0 ? (
              <li className="text-base-content/50 px-3 py-2 text-sm">{emptyText}</li>
            ) : (
              options.map((option, index) => {
                const isSelected = index === selectedIndex

                return (
                  <li
                    key={String(option.value)}
                    id={`${id}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onMouseEnter={() => !option.disabled && setActive(index)}
                    // mousedown, not click: picking must not blur the trigger
                    // first, or the dismiss handler would close the list under
                    // the pointer before the choice lands.
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pick(index)
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm transition-colors ${
                      option.action
                        ? 'border-base-content/10 text-primary border-t font-semibold'
                        : ''
                    } ${
                      option.disabled
                        ? 'pointer-events-none opacity-30'
                        : isSelected
                          ? 'bg-primary/15 text-primary font-medium'
                          : index === active
                            ? 'bg-base-content/8'
                            : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {option.dot && <Dot color={option.dot} />}
                      <span className="truncate">{option.label}</span>
                    </span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      option.hint && (
                        <span className="text-base-content/40 shrink-0 text-xs">{option.hint}</span>
                      )
                    )}
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )}
    </div>
  )
}

function Dot({ color }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}
