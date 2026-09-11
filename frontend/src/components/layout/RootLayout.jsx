import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { PageLoader } from '@/components/ui/PageLoader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScrollToTop } from '@/hooks/useScrollToTop'

import { Footer } from './Footer'
import { MobileTabBar } from './MobileTabBar'
import { Navbar } from './Navbar'

/**
 * The chrome every page sits inside.
 *
 * The boundary and Suspense wrap only the Outlet, so a page that throws or is
 * still loading leaves the tab bar intact and the user able to navigate away.
 */
export function RootLayout() {
  // Both live here rather than in each page: the layout renders on every route,
  // so one call each covers seventeen pages without any of them remembering to.
  useDocumentTitle()
  useScrollToTop()

  return (
    <div className="bg-base-200 flex min-h-screen flex-col">
      {/* Wide screens navigate from the top, phones from the bottom bar below.
          The Navbar hides itself under `lg`. */}
      <Navbar />

      {/*
        The tab bar is `position: fixed`, so it is outside the flow and covers
        whatever the page ends with. Clearing it here rather than in each page
        is what makes that reliable: a page that forgot — and eleven of them
        had — loses its last card behind the bar with no way to scroll to it.

        `env(safe-area-inset-bottom)` is added on top for the home indicator on
        notched iPhones, which eats a further ~34px.
      */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />

      {/* Phones navigate from the bottom bar; wide screens keep the footer. */}
      <MobileTabBar />
    </div>
  )
}
