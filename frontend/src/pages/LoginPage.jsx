import { Navigate } from 'react-router-dom'

import { AuthPanel } from '@/features/auth/components/AuthPanel'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLoginForm } from '@/features/auth/hooks/useLoginForm'

// Login page. Route: /login
export function LoginPage() {
  const { isAuthenticated } = useAuth()
  const login = useLoginForm()

  if (isAuthenticated) return <Navigate to={login.destination} replace />

  return (
    <AuthPanel>
      <LoginForm login={login} />
    </AuthPanel>
  )
}
