// Holds the signed-in user and exposes login/logout/register. Used by App.jsx.
// `status` is 3-state (loading/authenticated/anonymous) to avoid a login-page flash on reload.

import { useCallback, useEffect, useMemo, useState } from 'react'

import { auth } from '@/api/endpoints'
import { clearTokens, getAccessToken, setTokens } from '@/api/tokens'
import { clearPersistedCache } from '@/lib/persist'
import { queryClient } from '@/lib/queryClient'

import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  // loading | authenticated | anonymous.
  // Starts at 'anonymous' with no token so signed-out visitors skip a pointless loading flash.
  const [status, setStatus] = useState(() => (getAccessToken() ? 'loading' : 'anonymous'))

  // Turns a stored token into a user; API client transparently refreshes an expired access token first.
  useEffect(() => {
    if (!getAccessToken()) return

    let cancelled = false

    auth
      .me()
      .then((data) => {
        if (cancelled) return
        setUser(data)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        clearTokens()
        setStatus('anonymous')
      })

    // Avoid state update after unmount (StrictMode double-run).
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setTokens(await auth.token(email, password))

    const profile = await auth.me()
    setUser(profile)
    setStatus('authenticated')
    return profile
  }, [])

  const register = useCallback(
    async (payload) => {
      await auth.register(payload)
      // Sign straight in rather than requiring a separate login (plan §4, NEW 6).
      return login(payload.email, payload.password)
    },
    [login],
  )

  // Trades a Google credential for our token pair; server returns the profile too, so no /auth/me/ call needed.
  const loginWithGoogle = useCallback(async (credential) => {
    const data = await auth.google(credential)
    setTokens(data)

    setUser(data.user)
    setStatus('authenticated')

    // `created` lets the caller route a brand-new account differently from a returning one.
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      // Blacklists the refresh token server-side; best-effort.
      await auth.logout()
    } catch {
      // Already expired or offline — nothing to recover.
    } finally {
      clearTokens()

      // clear() empties the in-memory cache for this tab; clearPersistedCache() removes disk
      // cache, so the next person on this device doesn't see this user's data before any request runs.
      queryClient.clear()
      clearPersistedCache()

      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      loginWithGoogle,
      register,
      logout,
      setUser,
    }),
    [user, status, login, loginWithGoogle, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
