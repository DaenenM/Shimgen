import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { AuthProvider } from '@/context/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes/router'

/**
 * Provider stack.
 *
 * Order matters: AuthProvider issues requests through the same axios instance
 * React Query uses, and the router's guards read auth state, so auth must sit
 * outside the router. The outer ErrorBoundary is the last line of defence — if
 * a provider itself throws, the boundary inside RootLayout never mounts.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
