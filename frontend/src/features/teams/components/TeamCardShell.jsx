import { teamTone } from '../utils/tone'

/**
 * A team's card: its colour, number, editable name and head count.
 *
 * Shared by the team generator's results and the new-tournament team builder,
 * so a team looks the same on the page that rolled it and the page that
 * enters it. The body — a plain list of names, or an editable one — is the
 * caller's.
 *
 * `surface` is the glass class. The generator's cards sit on the open page and
 * take `glass-panel`; the builder's sit inside a panel already, where a second
 * heavy blur compounds into mud, so they take `glass-inset`.
 */
export function TeamCardShell({
  as: Tag = 'div',
  index,
  name,
  onRename,
  count,
  actions,
  surface = 'glass-panel',
  className = '',
  style,
  innerRef,
  onClick,
  children,
}) {
  const tone = teamTone(index)

  return (
    <Tag
      ref={innerRef}
      onClick={onClick}
      className={`${surface} relative overflow-hidden ${className}`}
      style={{ borderTopColor: tone.edge, ...style }}
    >
      {/* The team's hue as a light source above the panel rather than a stripe
          beside it: colour arriving through the glass is what ties the two
          ideas together. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: `linear-gradient(to bottom, ${tone.wash}, transparent)` }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold"
            style={{ backgroundColor: tone.wash, color: tone.edge }}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <input
            className="hover:border-base-content/15 hover:bg-base-content/5 focus:border-primary/50 focus:bg-base-content/5 w-full min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold transition-colors duration-150 focus:outline-none"
            value={name}
            placeholder={`Team ${index + 1}`}
            onChange={(e) => onRename(e.target.value)}
            aria-label={`Name for team ${index + 1}`}
          />
          <span className="bg-base-content/8 text-base-content/70 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {count}
          </span>
          {actions}
        </div>

        {children}
      </div>
    </Tag>
  )
}
