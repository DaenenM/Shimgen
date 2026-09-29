import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { roster } from '@/api/endpoints'
import { useLocalRoster } from '@/features/roster/hooks/useLocalRoster'
import { paths } from '@/routes/paths'

import { useAuth } from './useAuth'

/** State and handlers for the sign-up form, by password or by Google. */
export function useRegisterForm() {
  const { register, loginWithGoogle } = useAuth()
  const { players: localPlayers, clear: clearLocalRoster } = useLocalRoster()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', display_name: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

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

  return {
    form,
    update,
    formError: errors._,
    setFormError: (message) => setErrors({ _: message }),
    fieldError: (name) => errors[name]?.[0],
    busy,
    onSubmit,
    onGoogle,
  }
}
