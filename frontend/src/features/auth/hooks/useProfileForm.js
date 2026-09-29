import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { auth } from '@/api/endpoints'

import { useAuth } from './useAuth'

/** The editable half of the signed-in user's profile, and saving it. */
export function useProfileForm() {
  const { user, setUser } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    meta: { errorShown: true },
    mutationFn: () =>
      auth.updateMe({ display_name: displayName.trim(), username: username.trim() }),
    onSuccess: (updated) => {
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return { user, displayName, setDisplayName, username, setUsername, saved, save }
}
