import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { paths } from '@/routes/paths'

// Closing pitch for an account, shown only when signed out. Used by
// HomePage.jsx. Everything above works without one (plan §4, NEW 6); this says
// what an account adds rather than gating anything.
export function AccountPrompt() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return null

  return (
    <section className="rise-in rise-delay-8 mt-16 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Want to keep your results?</h2>
      <p className="text-base-content/60 mx-auto mt-2 max-w-xl text-pretty">
        Make a free account to save everything for next time.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button to={paths.register} size="lg" className="w-full sm:w-auto">
          Create a free account
        </Button>
        <p className="text-base-content/50 text-sm">
          or{' '}
          <Link to={paths.login} className="text-primary font-medium hover:underline">
            sign in
          </Link>
        </p>
      </div>
    </section>
  )
}
