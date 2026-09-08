import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

export function NotFoundPage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="text-base-content/70">
        No bracket here. The link may be wrong, or the event may have been deleted.
      </p>
      <Link to={paths.home} className="btn btn-primary">
        Back home
      </Link>
    </section>
  )
}
