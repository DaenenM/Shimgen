// Thin loading bar shown during route transitions. Used by RootLayout.jsx.
// Delayed 150ms so fast page loads never flash it.
export function NavigationProgress({ active }) {
  return (
    <div
      aria-hidden="true"
      // Animates toward 75% width, resets instantly (no transition) on landing.
      className={`bg-primary pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 origin-left ${
        active
          ? 'scale-x-75 opacity-100 transition-[transform,opacity] delay-150 duration-[1500ms] ease-out'
          : 'scale-x-0 opacity-0'
      }`}
    />
  )
}
