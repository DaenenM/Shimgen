import { AdSlot } from '@/components/ui/AdSlot'

/**
 * The frame every page sits in.
 *
 * Widths were chosen page by page and drifted to seven different values, so
 * moving between Stats and Tournaments visibly shifted the content edge. Three
 * named sizes replace them, picked by what the page holds rather than by taste:
 *
 *   narrow  a single column of form — auth, profile
 *   normal  a list or a page of cards — most of the app
 *   wide    a bracket, which needs every pixel of horizontal room
 *
 * `aside` opts into the sidebar layout: content on the left, a rail on the
 * right holding the page's own extras and an ad slot beneath them. The rail
 * collapses below `xl`, where its contents move under the content rather than
 * squeezing it.
 */

const WIDTHS = {
  narrow: 'max-w-2xl',
  // A list of short rows: wide enough for a long title, narrow enough that a
  // row's controls stay near its name instead of a screen's width away.
  list: 'max-w-3xl',
  normal: 'max-w-5xl',
  wide: 'max-w-[92rem]',
}

export function PageShell({ children, width = 'normal', aside, ads = true, className = '' }) {
  const container = `mx-auto w-full ${WIDTHS[width] ?? WIDTHS.normal} px-4 sm:px-6`

  // Clearance for the fixed tab bar belongs to the layout, not here: pages that
  // do not use this shell need it too, and duplicating it gave converted pages
  // twice the gap.
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

        {/* `self-start` keeps the rail from stretching to the content's height,
            which is what lets it stick. */}
        <aside className="min-w-0 space-y-6 xl:sticky xl:top-20 xl:self-start">
          {aside}
          {ads && <AdSlot placement="sidebar" />}
        </aside>
      </div>
    </div>
  )
}
