import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { paths } from '@/routes/paths'

import { useAuth } from './useAuth'

/** State and handlers for the sign-in form, by password or by Google. */
export function useLoginForm() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Where the route guard was trying to send them before it bounced them here.
  const destination = location.state?.from?.pathname || paths.dashboard

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

  return { form, update, error, setError, busy, destination, onSubmit, onGoogle }
}
