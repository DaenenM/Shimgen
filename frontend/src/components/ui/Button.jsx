import { Link } from 'react-router-dom'

/**
 * Every button on the site, in one place.
 *
 * Written by hand, the same action drifted: "New board" was `btn btn-primary
 * gap-2`, "New tournament" the same plus `btn-sm`, and "Put these teams in a
 * bracket" an outline at full width. Three sizes and two weights for one idea —
 * make a thing — and nobody chose that, it just accumulated.
 *
 * The choice this component asks for is what the action *is*, not what it
 * should look like:
 *
 *   primary    the one thing this screen is for
 *   secondary  a real action, but not the main one
 *   ghost      incidental — cancel, dismiss, a row control
 *   danger     destructive, and worth a second look
 *
 * `icon` takes a component, not an element, so callers cannot pass one at the
 * wrong size — the sizing lives here.
 *
 * Renders a router Link when given `to`, an anchor for `href`, and a button
 * otherwise. Callers write the action once and get the right element for it.
 */

/**
 * Shared by every variant: the shape, not the colour.
 *
 * `disabled:pointer-events-none` rather than a `cursor-not-allowed`: a disabled
 * button that still lifts and brightens on hover promises an action that will
 * not happen, and the 40% opacity is what says it is unavailable.
 */
const BASE =
  'group relative inline-flex items-center justify-center rounded-xl font-semibold ' +
  'transition-all duration-200 ease-out active:translate-y-0 active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none'

const VARIANTS = {
  // The one opaque thing on a glass page, so it reads as the way forward.
  primary:
    'bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 ' +
    'hover:shadow-primary/30 shadow-md hover:-translate-y-0.5 hover:shadow-lg',
  // Glass rather than an outline: a translucent surface catching more light is
  // what "raised" looks like in this material.
  secondary:
    'glass-raised hover:border-base-content/30 hover:bg-base-content/5 hover:-translate-y-0.5',
  ghost: 'text-base-content/70 hover:bg-base-content/8 hover:text-base-content',
  danger: 'text-error hover:bg-error/10 border border-error/30 hover:border-error/50',
}

// Heights rather than paddings, so a row of buttons lines up whatever is in
// them — an icon-only button and a long label are the same height.
const SIZES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-5 text-sm',
  lg: 'h-12 gap-2 px-7 text-sm',
}

// Icon scales with the button rather than being passed a size by each caller,
// which is how a 16px icon ended up next to 20px text in a few places.
const ICON_SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  // Trailing rather than leading, for "continue" and "next" style actions where
  // the arrow belongs after the words.
  iconAfter = false,
  to,
  href,
  block = false,
  loading = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const classes = [
    BASE,
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    block ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const mark = loading ? (
    <span className={`loading loading-spinner ${size === 'lg' ? '' : 'loading-sm'}`} />
  ) : Icon ? (
    <Icon className={ICON_SIZES[size] ?? ICON_SIZES.md} />
  ) : null

  const content = (
    <>
      {!iconAfter && mark}
      {children}
      {iconAfter && mark}
    </>
  )

  // A disabled link is not a thing the browser has, so it renders as a button
  // instead — which is what actually stops the navigation.
  if (to && !disabled && !loading) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }

  if (href && !disabled && !loading) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  )
}
