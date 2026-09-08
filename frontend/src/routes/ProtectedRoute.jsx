import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageLoader } from '@/components/ui/PageLoader'
import { useAuth } from '@/hooks/useAuth'

import { paths } from './paths'

/**
 * Gates a branch of the route tree behind authentication.
 *
 * The `isLoading` branch matters: without it, a signed-in user reloading the
 * page is redirected to /login for the split second before the profile request
 * resolves, and then bounced back — a visible flash on every refresh.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <PageLoader />

  if (!isAuthenticated) {
    // `state.from` lets the login page send them back where they were headed
    // instead of dumping everyone on the dashboard. `replace` keeps the
    // redirect out of history, so Back does not bounce off this guard again.
    return <Navigate to={paths.login} state={{ from: location }} replace />
  }

  return <Outlet />
}
