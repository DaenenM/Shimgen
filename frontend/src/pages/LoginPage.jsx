import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'
import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

export function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Where the route guard was trying to send them before it bounced them here.
  const destination = location.state?.from?.pathname || paths.dashboard

  if (isAuthenticated) return <Navigate to={destination} replace />

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await login(form.email, form.password)
      navigate(destination, { replace: true })
    } catch (err) {
      // A failed sign-in says only that the pair was wrong, never which half —
      // distinguishing them turns this form into an account-existence oracle.
      setError(
        err instanceof ApiError && err.status === 401
          ? 'That email and password do not match an account.'
          : (err.message ?? 'Could not sign in.'),
      )
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle(credential) {
    setBusy(true)
    setError(null)

    try {
      await loginWithGoogle(credential)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message ?? 'Could not sign in with Google.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-backdrop mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="glass-panel w-full">
        <form className="flex flex-col gap-4 p-5 sm:p-6" onSubmit={onSubmit}>
          <div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-base-content/60 mt-1 text-sm">
              Sign in to keep your rosters, brackets and stats.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
            >
              {error}
            </div>
          )}

          <label className="form-control">
            <span className="label-text mb-1">Email</span>
            <input
              type="email"
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 w-full px-3 text-sm transition-colors focus:outline-none"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              required
              autoFocus
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1">Password</span>
            <input
              type="password"
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 w-full px-3 text-sm transition-colors focus:outline-none"
              value={form.password}
              onChange={update('password')}
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            disabled={busy}
          >
            {busy && <span className="loading loading-spinner loading-sm" />}
            Sign in
          </button>

          <GoogleSignInButton onCredential={onGoogle} onError={setError} text="signin_with" />

          <p className="text-base-content/60 text-center text-sm">
            No account?{' '}
            <Link to={paths.register} className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </p>

          <p className="text-base-content/50 text-center text-xs">
            You don't need an account to{' '}
            <Link to={paths.quickStart} className="link">
              build a bracket
            </Link>
            .
          </p>
        </form>
      </div>
    </div>
  )
}
