import { Link } from 'react-router-dom'

// Shared button primitive. Variant names the action's role (primary/secondary/
// ghost/danger), not its look. Renders a Link with `to`, an anchor with
// `href`, else a button. `icon` takes a component so sizing stays consistent.

// Shape shared by every variant; colour lives in VARIANTS.
const BASE =
  'group relative inline-flex items-center justify-center rounded-xl font-semibold ' +
  'transition-all duration-200 ease-out active:translate-y-0 active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none'

const VARIANTS = {
  primary:
    'bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 ' +
    'hover:shadow-primary/30 shadow-md hover:-translate-y-0.5 hover:shadow-lg',
  secondary:
    'glass-raised hover:border-base-content/30 hover:bg-base-content/5 hover:-translate-y-0.5',
  ghost: 'text-base-content/70 hover:bg-base-content/8 hover:text-base-content',
  danger: 'text-error hover:bg-error/10 border border-error/30 hover:border-error/50',
}

// Fixed heights so buttons align regardless of content.
const SIZES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-5 text-sm',
  lg: 'h-12 gap-2 px-7 text-sm',
}

// Icon size scales with button size.
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
  // For "continue"/"next" style actions where the icon trails the label.
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

  // A disabled link isn't a real thing in HTML, so fall back to a button.
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
