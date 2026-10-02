import { Link } from 'react-router-dom'

import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { paths } from '@/routes/paths'

import { AuthField } from './AuthField'
import { GoogleSignInButton } from './GoogleSignInButton'
import { SubmitButton } from './SubmitButton'

// Sign-in form (email/password or Google). Used by LoginPage.jsx.
// name/id on inputs matter for autofill/password-manager matching, not just autoComplete.
export function LoginForm({ login }) {
  const { form, update, error, setError, busy, onSubmit, onGoogle } = login

  return (
    <form className="flex flex-col gap-4 p-5 sm:p-6" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-base-content/60 mt-1 text-sm">
          Sign in to keep your rosters, brackets and stats.
        </p>
      </div>

      <ErrorAlert>{error}</ErrorAlert>

      <AuthField
        label="Email"
        type="email"
        id="email"
        name="email"
        value={form.email}
        onChange={update('email')}
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
      />

      <AuthField
        label="Password"
        type="password"
        id="current-password"
        name="password"
        value={form.password}
        onChange={update('password')}
        autoComplete="current-password"
        required
      />

      <SubmitButton busy={busy} className="mt-2">
        Sign in
      </SubmitButton>

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
          run a tournament
        </Link>
        .
      </p>
    </form>
  )
}
