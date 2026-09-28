import { Check, ChevronDown } from '@/components/icons'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useDismiss } from '@/hooks/useDismiss'

const SIZES = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3 text-sm',
}

// Space kept between the trigger and the list, and from the viewport's edge.
const GAP = 6
const MARGIN = 8

/**
 * Every dropdown on the site.
 *
 * The browser's own <select> could not be styled to match the glass — its
 * list is drawn by the OS — so the site had grown two looks for one control.
 * This is the one the team generator's rules introduced, made general.
 *
 * `options` is a list of `{ value, label, disabled?, hint?, dot?, action? }`:
 * `hint` is quiet text at the end of an option (why it is disabled, say), `dot`
 * is a CSS colour shown as a swatch before the label, in the list and on the
 * trigger — a team's colour — and `action` marks an entry that does something
 * rather than choosing a value ("+ New board…"). Actions are set apart by a
 * rule above and the interactive blue, so they are not read as one more item.
 *
 * The list is portalled to <body> and positioned against the trigger. Rendered
 * in place it was trapped by every glass panel around it: `backdrop-filter`
 * makes each one a stacking context and a scroll container clips, so a list
 * opening near the foot of a panel slid under the next thing on the page. It
 * flips above the trigger when there is not room below.
 *
 * Keyboard: Enter, Space or the arrows open it; the arrows, Home and End move
 * through the enabled options; Enter or Space picks; Escape or Tab closes.
 *
 * `onOpenChange(label, open)` still reports open and close, for a parent that
 * wants to react to it.
 */
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

  /**
   * Place the list under the trigger — or over it, when the viewport runs out.
   *
   * Recomputed on any scroll or resize while open, capture-phase so a scroll
   * inside a panel counts as well as the page's own.
   */
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
            // No vertical padding: the first and last options run to the edge,
            // and `overflow-auto` clips them to the list's own corners, so a
            // highlighted top or bottom option follows the curve instead of
            // stopping short of it with a sliver of empty glass above or below.
            // `rounded-xl` rather than the glass default: at an option's height
            // a 1rem corner cut visibly into the highlight.
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
