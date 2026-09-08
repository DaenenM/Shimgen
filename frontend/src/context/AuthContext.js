/**
 * The auth context object itself.
 *
 * Kept in its own non-component module on purpose: React Fast Refresh can only
 * hot-reload a file that exports components exclusively, so mixing the provider
 * component and this constant would make every auth edit trigger a full reload.
 */

import { createContext } from 'react'

export const AuthContext = createContext(null)
