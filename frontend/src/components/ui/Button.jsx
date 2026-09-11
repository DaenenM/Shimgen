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

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-error btn-outline',
}

const SIZES = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
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
    'btn',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? '',
    Icon || loading ? 'gap-2' : '',
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
