import { useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query currently matches.
 *
 * For the cases a class cannot cover — where the *content* changes with the
 * viewport rather than its arrangement. A board's tally is the example: seven
 * tridents read at a glance on a monitor and turn into an unreadable smear on a
 * phone, so the small screen wants the number instead. CSS can hide one and
 * show the other, but that means rendering both, and the emoji row is the
 * expensive half.
 *
 * `useSyncExternalStore` rather than an effect: it reads the real value on the
 * first render, so there is no flash of the wrong layout before an effect
 * corrects it, and it is safe if this ever renders on a server.
 */
export function useMediaQuery(query) {
  const subscribe = (onChange) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}

    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }

  const getSnapshot = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }

  // Server and pre-hydration both answer "not small", which matches the
  // desktop-first markup and avoids a hydration mismatch.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** True on phone-width screens — Tailwind's `sm` breakpoint, from below. */
export function useIsSmallScreen() {
  return useMediaQuery('(max-width: 639px)')
}
