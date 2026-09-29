// Title block every page opens with: heading, description, and action
// buttons. Stacked on a phone, side by side from `sm` up.
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
        // flex-auto: actions size to their label instead of splitting evenly.
        <div className="flex shrink-0 flex-wrap gap-2 [&>*]:flex-auto sm:[&>*]:flex-none">
          {children}
        </div>
      )}
    </div>
  )
}
