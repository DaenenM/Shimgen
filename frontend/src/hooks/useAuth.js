import { use } from 'react'

import { AuthContext } from '@/context/AuthContext'

/**
 * Read the auth state.
 *
 * Throws when used outside AuthProvider rather than returning null, so the
 * mistake surfaces as a clear message at the point of use instead of a
 * "cannot read properties of null" further down the render.
 */
export function useAuth() {
  const context = use(AuthContext)

  if (context === null) {
    throw new Error('useAuth must be used inside an <AuthProvider>.')
  }

  return context
}
