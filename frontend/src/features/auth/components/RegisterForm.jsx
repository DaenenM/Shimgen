import { Link } from 'react-router-dom'

import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { paths } from '@/routes/paths'

import { AuthField } from './AuthField'
import { GoogleSignInButton } from './GoogleSignInButton'
import { SubmitButton } from './SubmitButton'

// Sign-up form (email/password or Google). Used by RegisterPage.jsx.
// name/id on inputs matter for autofill/password-manager matching, not just autoComplete.
export function RegisterForm({ registration }) {
  const { form, update, formError, setFormError, fieldError, busy, onSubmit, onGoogle } =
    registration

  return (
    <form className="flex flex-col gap-4 p-5 sm:p-6" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="text-base-content/60 mt-1 text-sm">
          Keeps your roster, stats and brackets between game nights.
        </p>
      </div>

      <ErrorAlert>{formError}</ErrorAlert>

      <AuthField
        label="Display name"
        optional
        type="text"
        id="display_name"
        name="display_name"
        value={form.display_name}
        onChange={update('display_name')}
        placeholder="What your friends call you"
        autoComplete="nickname"
        autoFocus
      />

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
        error={fieldError('email')}
      />

      <AuthField
        label="Password"
        type="password"
        id="new-password"
        name="password"
        value={form.password}
        onChange={update('password')}
        autoComplete="new-password"
        required
        error={fieldError('password')}
        hint="At least 8 characters."
      />

      <SubmitButton busy={busy} className="mt-2">
        Create account
      </SubmitButton>

      <GoogleSignInButton onCredential={onGoogle} onError={setFormError} text="signup_with" />

      <p className="text-base-content/60 text-center text-sm">
        Already have one?{' '}
        <Link to={paths.login} className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
