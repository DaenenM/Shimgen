import { Link } from 'react-router-dom'

import { ArrowRight } from '@/components/icons'

// One tool card; the whole card links to its page. Used by ToolGrid.jsx.
export function ToolCard({ icon: Icon, title, body, to, action, note, delay = '' }) {
  return (
    <Link
      to={to}
      className={`group glass-panel hover:border-base-content/20 rise-in ${delay} flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="bg-primary/15 text-primary grid h-10 w-10 place-items-center rounded-xl">
          <Icon className="h-5 w-5" />
        </span>
        {note && (
          <span className="glass-inset text-base-content/60 rounded-full px-2.5 py-0.5 text-xs font-medium">
            {note}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="text-base-content/60 mt-1.5 flex-1 text-sm">{body}</p>

      <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-semibold">
        {action}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
