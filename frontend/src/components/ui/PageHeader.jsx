/** Consistent page title block, with room for actions on the right. */
export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="text-base-content/60 mt-1 text-sm">{description}</p>}
      </div>

      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
