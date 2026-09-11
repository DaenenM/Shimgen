import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { AuthProvider } from '@/context/AuthProvider'
import { persistOptions } from '@/lib/persist'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes/router'

/**
 * Provider stack.
 *
 * Order matters: AuthProvider issues requests through the same axios instance
 * React Query uses, and the router's guards read auth state, so auth must sit
 * outside the router. The outer ErrorBoundary is the last line of defence — if
 * a provider itself throws, the boundary inside RootLayout never mounts.
 *
 * `PersistQueryClientProvider` rather than `QueryClientProvider`: it restores
 * the stored cache before rendering its children, so a returning visitor's
 * tournaments and boards are already in the cache on the first paint instead of
 * arriving a request later. It is the same provider otherwise — see
 * `lib/persist.js` for what is written to disk and, more importantly, what is
 * deliberately not.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}
