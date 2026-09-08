import { Link } from 'react-router-dom'

/**
 * What a list shows before it has anything in it.
 *
 * Always offers the next action rather than just saying "nothing here" — an
 * empty state that dead-ends is a page the user leaves.
 */
export function EmptyState({ icon: Icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
      {Icon && <Icon className="text-base-content/30 h-10 w-10" />}

      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-base-content/60 mt-1 max-w-md text-sm">{description}</p>}
      </div>

      {actionLabel &&
        (actionTo ? (
          <Link to={actionTo} className="btn btn-primary btn-sm mt-1">
            {actionLabel}
          </Link>
        ) : (
          <button onClick={onAction} className="btn btn-primary btn-sm mt-1">
            {actionLabel}
          </button>
        ))}
    </div>
  )
}
