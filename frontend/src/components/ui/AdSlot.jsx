// Reserved space for an ad slot, sized before any ad network is wired in, so
// space doesn't shift layout when one lands. Used by PageShell.jsx.
// To hook up a network later: render its container inside `children`.

const PLACEMENTS = {
  'mobile-banner': {
    // 320x50 IAB size. Hidden at `lg` since the sidebar rail covers wide screens.
    box: 'h-[3.75rem] w-full max-w-[20rem]',
    wrapper: 'mb-4 flex justify-center lg:hidden',
    label: 'Advertisement',
  },
  sidebar: {
    box: 'h-[15.625rem] w-full max-w-[18.75rem]', // 300x250
    wrapper: 'hidden xl:flex xl:justify-center',
    label: 'Advertisement',
  },
  footer: {
    box: 'h-[6.25rem] w-full max-w-[45.5rem]', // 728x90 leaderboard
    wrapper: 'flex justify-center',
    label: 'Advertisement',
  },
}

export function AdSlot({ placement = 'footer', children, className = '' }) {
  const spec = PLACEMENTS[placement] ?? PLACEMENTS.footer

  // No placeholder in production — an empty box reads as a broken image.
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
