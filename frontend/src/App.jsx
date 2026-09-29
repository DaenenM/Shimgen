import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Toaster } from '@/components/ui/Toaster'
import { AuthProvider } from '@/features/auth/context/AuthProvider'
import { persistOptions } from '@/lib/persist'
import { queryClient } from '@/lib/queryClient'
import { preloadPages, router } from '@/routes/router'

// The app's provider stack (auth, query client, router, error boundary, toasts).
// Order matters: AuthProvider must sit outside the router since its guards read
// auth state, and the outer ErrorBoundary catches a provider itself throwing.
// PersistQueryClientProvider restores the cached tournaments/boards before the
// first paint (see lib/persist.js for what's persisted).
export default function App() {
  // Preload the rest of the pages in the background once the first one is up.
  useEffect(preloadPages, [])

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <Toaster />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}
