/**
 * A thin bar across the top while a page is on its way.
 *
 * Held back for 150ms before it shows, so a page that arrives quickly — which
 * is every page once the background preload has run — never flashes it.
 */
export function NavigationProgress({ active }) {
  return (
    <div
      aria-hidden="true"
      // Creeps toward three quarters while waiting, since how long is unknown,
      // and is gone the moment the page lands. It resets without a transition,
      // so it never visibly runs backwards.
      className={`bg-primary pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 origin-left ${
        active
          ? 'scale-x-75 opacity-100 transition-[transform,opacity] delay-150 duration-[1500ms] ease-out'
          : 'scale-x-0 opacity-0'
      }`}
    />
  )
}
