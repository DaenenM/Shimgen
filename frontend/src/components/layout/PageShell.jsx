import { AdSlot } from '@/components/ui/AdSlot'

// Page frame with a shared set of max-widths. Used by page components across
// the app to keep content edges consistent.
// `aside` opts into a sidebar layout that collapses below `xl`.

const WIDTHS = {
  narrow: 'max-w-2xl', // single-column form — auth, profile
  list: 'max-w-3xl', // list of short rows
  normal: 'max-w-5xl', // default — most pages
  wide: 'max-w-[92rem]', // bracket view
}

export function PageShell({ children, width = 'normal', aside, ads = true, className = '' }) {
  const container = `mx-auto w-full ${WIDTHS[width] ?? WIDTHS.normal} px-4 sm:px-6`

  const spacing = 'py-6 sm:py-8'

  if (!aside) {
    return (
      <div className={`${container} ${spacing} ${className}`}>
        {ads && <AdSlot placement="mobile-banner" />}
        {children}
        {ads && <AdSlot placement="footer" className="mt-10" />}
      </div>
    )
  }

  return (
    <div className={`${container} ${spacing} ${className}`}>
      {ads && <AdSlot placement="mobile-banner" />}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{children}</div>

        {/* `self-start` stops the rail stretching to content height, so it can stick. */}
        <aside className="min-w-0 space-y-6 xl:sticky xl:top-20 xl:self-start">
          {aside}
          {ads && <AdSlot placement="sidebar" />}
        </aside>
      </div>
    </div>
  )
}
