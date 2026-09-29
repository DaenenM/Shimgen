import { Suspense } from 'react'
import { Outlet, useNavigation } from 'react-router-dom'

import { RouteErrorBoundary } from '@/components/ui/ErrorBoundary'
import { PageLoader } from '@/components/ui/PageLoader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScrollToTop } from '@/hooks/useScrollToTop'

import { Footer } from './footer/Footer'
import { MobileNav } from './mobile-nav/MobileNav'
import { Navbar } from './navbar/Navbar'
import { NavigationProgress } from './NavigationProgress'

// App chrome wrapping every route's Outlet. The error boundary and Suspense
// wrap only the Outlet, so navigation stays usable if a page throws or loads slowly.
export function RootLayout() {
  // Runs once here instead of per-page, since this layout renders on every route.
  useDocumentTitle()
  useScrollToTop()

  // True while waiting on a lazy page chunk; current page stays visible until it lands.
  const navigating = useNavigation().state === 'loading'

  return (
    <div className="bg-base-200 flex min-h-screen flex-col">
      <NavigationProgress active={navigating} />
      {/* Navbar hides below `lg`; MobileNav hides at `lg` and above. */}
      <Navbar />
      <MobileNav />

      {/* Clears the fixed phone header (plus safe-area inset for the notch).
          Not needed at `lg`+, where the Navbar is sticky instead of fixed. */}
      <main className="flex-1 pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0">
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>

      <Footer />
    </div>
  )
}
