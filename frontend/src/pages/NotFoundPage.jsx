import { House, Trophy } from '@/components/icons'
import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

/**
 * A link that went nowhere.
 *
 * Reached by `path: '*'` inside the layout, so the nav is still there and this
 * is a dead end only for the URL, not for the visit. It offers the two places
 * worth going rather than a single "back home", because a broken link is very
 * often a shared bracket that has since been deleted — and the person holding
 * it came to look at a tournament, not at a home page.
 */
export function NotFoundPage() {
  return (
    <div className="glass-backdrop mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-10">
      <div className="glass-panel rise-in w-full">
        <div className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
          {/* Set in the panel's own tint rather than as a headline: the number
              is context, and at 5rem solid it was the loudest thing on a page
              whose job is to move somebody along. */}
          <span className="text-base-content/15 text-6xl leading-none font-black tracking-tight">
            404
          </span>

          <div>
            <h1 className="text-xl font-bold tracking-tight">No bracket here</h1>
            <p className="text-base-content/60 mt-1.5 text-sm">
              The link may be wrong, or the event may have been deleted.
            </p>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Link
              to={paths.home}
              className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
            >
              <House className="h-4 w-4" />
              Back home
            </Link>

            <Link
              to={paths.tournaments}
              className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <Trophy className="h-4 w-4" />
              Your tournaments
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
