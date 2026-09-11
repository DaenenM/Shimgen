/**
 * A surface that sits on the page.
 *
 * Cards were written by hand and drifted into eight variants — some with
 * shadows, some without, padding between p-3 and p-5, margins baked into the
 * card itself rather than left to whatever is arranging it. Different pages
 * ended up with visibly different card metrics.
 *
 * One set of metrics here, and spacing stays the parent's job: a card that
 * carries `mb-6` cannot be put in a grid.
 */

const PADDING = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}

export function Card({
  children,
  padding = 'md',
  // Interactive cards lift slightly. Static ones must not, or every list looks
  // clickable and the ones that are stop standing out.
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

/**
 * A card's own heading row.
 *
 * Sits inside a `padding="none"` card so the divider can run the full width
 * rather than stopping short of the padding.
 */
export function CardHeader({ title, description, children, className = '' }) {
  return (
    <div
      className={`border-base-content/10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        {description && <p className="text-base-content/60 mt-0.5 text-sm">{description}</p>}
      </div>

      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  )
}
