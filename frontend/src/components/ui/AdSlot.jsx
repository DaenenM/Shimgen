/**
 * Reserved space for an advertisement.
 *
 * Built before there are ads to put in it, deliberately. An ad dropped into a
 * page that never budgeted for it pushes content down as it loads — the single
 * most irritating thing a page can do, and the reason Core Web Vitals scores
 * layout shift at all. Reserving the box now means the ad appears *into* space
 * that was always there.
 *
 * Each placement declares the real IAB size it will hold:
 *
 *   mobile-banner  320×50, above the content, small screens only
 *   sidebar        300×250, in the rail, wide screens only
 *   footer         728×90 leaderboard, under the content
 *
 * To hook up a network later: render the script's container inside `children`
 * and the reserved box becomes its frame. Until something is passed, a quiet
 * placeholder shows in development and nothing at all ships to users — an empty
 * bordered rectangle on a live site reads as a broken image.
 */

const PLACEMENTS = {
  'mobile-banner': {
    // 320×50 plus breathing room. `lg:hidden` because the sidebar rail serves
    // wide screens and two slots at once is where a page starts feeling cheap.
    box: 'h-[3.75rem] w-full max-w-[20rem]',
    wrapper: 'mb-4 flex justify-center lg:hidden',
    label: 'Advertisement',
  },
  sidebar: {
    box: 'h-[15.625rem] w-full max-w-[18.75rem]',
    wrapper: 'hidden xl:flex xl:justify-center',
    label: 'Advertisement',
  },
  footer: {
    box: 'h-[6.25rem] w-full max-w-[45.5rem]',
    wrapper: 'flex justify-center',
    label: 'Advertisement',
  },
}

export function AdSlot({ placement = 'footer', children, className = '' }) {
  const spec = PLACEMENTS[placement] ?? PLACEMENTS.footer

  // Nothing to show and nothing to reserve: an empty box on a production page
  // is worse than no box. In development it stays visible so the space it will
  // occupy is part of what gets designed around.
  if (!children && import.meta.env.PROD) return null

  return (
    <div className={`${spec.wrapper} ${className}`} role="complementary" aria-label={spec.label}>
      <div
        className={`${spec.box} border-base-300/60 text-base-content/30 grid place-items-center overflow-hidden rounded-xl border border-dashed text-[0.6875rem] tracking-widest uppercase`}
      >
        {children ?? spec.label}
      </div>
    </div>
  )
}
