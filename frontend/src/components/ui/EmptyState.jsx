import { Link } from 'react-router-dom'

/**
 * What a list shows before it has anything in it.
 *
 * Always offers the next action rather than just saying "nothing here" — an
 * empty state that dead-ends is a page the user leaves.
 */
export function EmptyState({ icon: Icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    // Dashed and translucent rather than a filled card: an empty state is an
    // outline of where content will be, and on the glass pages a solid panel
    // here competes with the real ones around it.
    <div className="border-base-content/15 bg-base-content/[0.03] flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed p-10 text-center">
      {Icon && <Icon className="text-base-content/30 h-10 w-10" />}

      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-base-content/60 mt-1 max-w-md text-sm">{description}</p>}
      </div>

      {actionLabel &&
        (actionTo ? (
          <Link
            to={actionTo}
            className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 mt-1 flex h-10 items-center rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 mt-1 flex h-10 items-center rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        ))}
    </div>
  )
}
