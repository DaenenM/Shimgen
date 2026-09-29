import { use } from 'react'

import { AuthContext } from '../context/AuthContext'

// Reads the auth context. Used across auth hooks, Navbar.jsx, ProtectedRoute.jsx, and other pages.
// Throws outside AuthProvider instead of returning null, for a clear error at the call site.
export function useAuth() {
  const context = use(AuthContext)

  if (context === null) {
    throw new Error('useAuth must be used inside an <AuthProvider>.')
  }

  return context
}
