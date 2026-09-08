import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { PageLoader } from '@/components/ui/PageLoader'

import { Footer } from './Footer'
import { Navbar } from './Navbar'

/**
 * The chrome every page sits inside.
 *
 * The boundary and Suspense wrap only the Outlet, so a page that throws or is
 * still loading leaves the navbar intact and the user able to navigate away.
 */
export function RootLayout() {
  return (
    <div className="bg-base-200 flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  )
}
