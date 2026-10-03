import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { auth } from '@/api/endpoints'

import { useAuth } from './useAuth'

// Editable profile fields (display name, username) and saving them. Used by ProfileForm.jsx.
export function useProfileForm() {
  const { user, setUser } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [saved, setSaved] = useState(false)

  // Navbar name updates on click; a refused username rolls it back.
  const save = useMutation({
    meta: { errorShown: true },
    mutationFn: () =>
      auth.updateMe({ display_name: displayName.trim(), username: username.trim() }),
    onMutate: () => {
      setUser({ ...user, display_name: displayName.trim(), username: username.trim() })
      return { previous: user }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) setUser(context.previous)
    },
    onSuccess: (updated) => {
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return { user, displayName, setDisplayName, username, setUsername, saved, save }
}
