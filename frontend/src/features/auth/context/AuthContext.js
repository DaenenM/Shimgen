// Auth context object. Used by AuthProvider.jsx, useAuth.js.
// Kept separate from AuthProvider so Fast Refresh can still hot-reload the component file.

import { createContext } from 'react'

export const AuthContext = createContext(null)
