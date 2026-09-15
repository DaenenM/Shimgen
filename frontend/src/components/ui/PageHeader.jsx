/**
 * The title block every page opens with.
 *
 * Stacked on a phone, side by side from `sm` up. Wrapping the actions onto a
 * second line — which is what a plain `flex-wrap` row does at narrow widths —
 * left them hanging under the description with no clear relationship to it, and
 * at different positions on every page depending on how long the title was.
 *
 * Actions share the row on a phone, but by their content rather than in equal
 * halves. Splitting evenly gave every action the same width whatever it said,
 * so "New tournament" sat cramped against its icon while "Teams" was a wide
 * button with one short word adrift in the middle. `flex-auto` sizes each to
 * its label and divides only the slack, which keeps the pair filling the row —
 * the touch target and the tidy edge that stretching was there for — without
 * pretending a two-word action needs as much room as a one-word one.
 */
export function PageHeader({ title, description, children, className = '' }) {
  return (
    <div
      className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 ${className}`}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="text-base-content/60 mt-1 text-sm">{description}</p>}
      </div>

      {children && (
        <div className="flex shrink-0 flex-wrap gap-2 [&>*]:flex-auto sm:[&>*]:flex-none">
          {children}
        </div>
      )}
    </div>
  )
}
