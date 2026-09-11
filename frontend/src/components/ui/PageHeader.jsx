/**
 * The title block every page opens with.
 *
 * Stacked on a phone, side by side from `sm` up. Wrapping the actions onto a
 * second line — which is what a plain `flex-wrap` row does at narrow widths —
 * left them hanging under the description with no clear relationship to it, and
 * at different positions on every page depending on how long the title was.
 *
 * Actions stretch to fill the row on a phone so two buttons split it evenly,
 * which is both a bigger touch target and a tidier edge than two shrink-wrapped
 * buttons against the left margin.
 */
export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="text-base-content/60 mt-1 text-sm">{description}</p>}
      </div>

      {children && (
        <div className="flex shrink-0 flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
          {children}
        </div>
      )}
    </div>
  )
}
