/**
 * Holds the signed-in user and exposes login / logout / register.
 *
 * `status` is a three-state value rather than a boolean, because "we have not
 * checked yet" and "definitely signed out" must render differently: treating
 * them the same flashes the login page for a moment on every reload for a user
 * who is in fact signed in.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { clearTokens, getAccessToken, setTokens } from '@/api/tokens'

import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  // loading | authenticated | anonymous.
  //
  // Initialised from storage during render rather than in the effect below: with
  // no token there is nothing to verify, so starting at 'loading' would mean a
  // pointless extra render and a flash of the loading state for every signed-out
  // visitor — which is most of them, on the public quick-start and spectator pages.
  const [status, setStatus] = useState(() => (getAccessToken() ? 'loading' : 'anonymous'))

  // With a token in hand, turn it into a user — or find out it is no longer
  // valid. The request goes through `api`, so an expired access token is
  // transparently refreshed before this concludes the user is signed out.
  useEffect(() => {
    if (!getAccessToken()) return

    let cancelled = false

    api
      .get('/auth/me/')
      .then(({ data }) => {
        if (cancelled) return
        setUser(data)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        clearTokens()
        setStatus('anonymous')
      })

    // Guards against a state update after unmount in StrictMode's double-run.
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/token/', { email, password })
    setTokens(data)

    const { data: profile } = await api.get('/auth/me/')
    setUser(profile)
    setStatus('authenticated')
    return profile
  }, [])

  const register = useCallback(
    async (payload) => {
      await api.post('/auth/register/', payload)
      // Sign straight in: making someone log in immediately after registering is
      // pure friction, and the plan is explicit about friction at the front
      // being what kills tools like this (plan §4, NEW 6).
      return login(payload.email, payload.password)
    },
    [login],
  )

  /**
   * Trade a Google credential for our own token pair.
   *
   * The server returns the profile alongside the tokens, so unlike `login`
   * this needs no follow-up call to /auth/me/ — one round trip instead of two
   * on the path people will use most.
   */
  const loginWithGoogle = useCallback(async (credential) => {
    const { data } = await api.post('/auth/google/', { credential })
    setTokens(data)

    setUser(data.user)
    setStatus('authenticated')

    // `created` lets the caller route a brand-new account differently from a
    // returning one.
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      // Blacklists the refresh token server-side. Best-effort: if it fails, the
      // local tokens are still cleared below, so the user is signed out here.
      await api.post('/auth/logout/')
    } catch {
      // Already expired or the network is down — nothing to recover.
    } finally {
      clearTokens()
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
