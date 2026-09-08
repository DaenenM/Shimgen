import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { roster } from '@/api/endpoints'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'
import { useAuth } from '@/hooks/useAuth'
import { useLocalRoster } from '@/hooks/useLocalRoster'
import { paths } from '@/routes/paths'

export function RegisterPage() {
  const { register, loginWithGoogle, isAuthenticated } = useAuth()
  const { players: localPlayers, clear: clearLocalRoster } = useLocalRoster()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', display_name: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to={paths.dashboard} replace />

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})

    try {
      await register(form)

      await mergeLocalRoster()
      navigate(paths.dashboard, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...err.details, _: err.details ? null : err.message })
      } else {
        setErrors({ _: 'Could not create your account.' })
      }
    } finally {
      setBusy(false)
    }
  }

  /**
   * Carry a logged-out roster into the new account.
   *
   * The localStorage shape mirrors the server's Player model on purpose
   * (plan §5), so this is a straight bulk insert. Shared by both signup paths,
   * because someone who clicks Continue with Google should keep the names they
   * typed just as much as someone who fills in the form.
   */
  async function mergeLocalRoster() {
    if (localPlayers.length === 0) return

    try {
      await roster.mergeLocal(localPlayers.map((p) => p.display_name))
      clearLocalRoster()
    } catch {
      // A failed merge must not undo a signup that already succeeded; the
      // local list stays put and can be merged again later.
    }
  }

  async function onGoogle(credential) {
    setBusy(true)
    setErrors({})

    try {
      await loginWithGoogle(credential)
      await mergeLocalRoster()
      navigate(paths.dashboard, { replace: true })
    } catch (err) {
      setErrors({ _: err.message ?? 'Could not sign up with Google.' })
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (name) => errors[name]?.[0]

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="card bg-base-100 border-base-300 w-full border shadow-sm">
        <form className="card-body gap-4" onSubmit={onSubmit}>
          <div>
            <h1 className="text-2xl font-bold">Create an account</h1>
            <p className="text-base-content/60 mt-1 text-sm">
              Keeps your roster, stats and brackets between game nights.
            </p>
          </div>

          {errors._ && (
            <div role="alert" className="alert alert-error py-2 text-sm">
              {errors._}
            </div>
          )}

          <label className="form-control">
            <span className="label-text mb-1">
              Display name <span className="text-base-content/40">(optional)</span>
            </span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={form.display_name}
              onChange={update('display_name')}
              placeholder="What your friends call you"
              autoComplete="nickname"
              autoFocus
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1">Email</span>
            <input
              type="email"
              className={`input input-bordered w-full ${fieldError('email') ? 'input-error' : ''}`}
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              required
            />
            {fieldError('email') && (
              <span className="text-error mt-1 text-xs">{fieldError('email')}</span>
            )}
          </label>

          <label className="form-control">
            <span className="label-text mb-1">Password</span>
            <input
              type="password"
              className={`input input-bordered w-full ${
                fieldError('password') ? 'input-error' : ''
              }`}
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              required
            />
            {fieldError('password') ? (
              <span className="text-error mt-1 text-xs">{fieldError('password')}</span>
            ) : (
              <span className="text-base-content/50 mt-1 text-xs">At least 8 characters.</span>
            )}
          </label>

          <button type="submit" className="btn btn-primary mt-2" disabled={busy}>
            {busy && <span className="loading loading-spinner loading-sm" />}
            Create account
          </button>

          <GoogleSignInButton
            onCredential={onGoogle}
            onError={(message) => setErrors({ _: message })}
            text="signup_with"
          />

          <p className="text-base-content/60 text-center text-sm">
            Already have one?{' '}
            <Link to={paths.login} className="link link-primary">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
