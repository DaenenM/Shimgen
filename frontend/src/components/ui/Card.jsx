// Shared card surface primitive with one set of padding/shadow metrics.
// Never carries its own margin — spacing is the parent's job.

const PADDING = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}

export function Card({
  children,
  padding = 'md',
  // Static cards must not lift on hover, or clickable ones stop standing out.
  interactive = false,
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  return (
    <Tag
      className={[
        'glass-panel',
        PADDING[padding] ?? PADDING.md,
        interactive
          ? 'hover:border-base-content/25 hover:bg-base-content/5 transition-colors duration-200'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  )
}
