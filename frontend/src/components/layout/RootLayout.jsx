import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { RouteErrorBoundary } from '@/components/ui/ErrorBoundary'
import { PageLoader } from '@/components/ui/PageLoader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScrollToTop } from '@/hooks/useScrollToTop'

import { Footer } from './Footer'
import { MobileNav } from './MobileNav'
import { Navbar } from './Navbar'

/**
 * The chrome every page sits inside.
 *
 * The boundary and Suspense wrap only the Outlet, so a page that throws or is
 * still loading leaves the navigation intact and the user able to move away
 * from it.
 */
export function RootLayout() {
  // Both live here rather than in each page: the layout renders on every route,
  // so one call each covers seventeen pages without any of them remembering to.
  useDocumentTitle()
  useScrollToTop()

  return (
    <div className="bg-base-200 flex min-h-screen flex-col">
      {/* Two navigations, one per breakpoint: the Navbar hides itself under
          `lg`, and MobileNav hides itself at `lg` and above. */}
      <Navbar />
      <MobileNav />

      {/*
        The phone header is `position: fixed`, so it is outside the flow and
        would cover whatever the page starts with. Clearing it here rather than
        in each page is what makes that reliable: a page that forgot — and
        eleven of them had, back when this was a bottom bar — loses its title
        behind the chrome.

        `env(safe-area-inset-top)` is added on top for the notch, which eats a
        further ~47px on an iPhone. At `lg` the Navbar is sticky rather than
        fixed, so it occupies real space and needs no allowance.
      */}
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
