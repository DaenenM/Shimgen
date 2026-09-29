import { Navigate } from 'react-router-dom'

import { AuthPanel } from '@/features/auth/components/AuthPanel'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useRegisterForm } from '@/features/auth/hooks/useRegisterForm'
import { paths } from '@/routes/paths'

// Registration page. Route: /register
export function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const registration = useRegisterForm()

  if (isAuthenticated) return <Navigate to={paths.dashboard} replace />

  return (
    <AuthPanel>
      <RegisterForm registration={registration} />
    </AuthPanel>
  )
}
