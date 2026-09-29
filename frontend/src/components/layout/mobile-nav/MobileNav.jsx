import { useEffect, useRef, useState } from 'react'

import { Menu, X } from '@/components/icons'

import { Brand } from '../Brand'
import { MobileMenu } from './MobileMenu'

/**
 * The phone navigation: a top bar with a hamburger, and the sheet it opens.
 *
 * This replaced a bottom tab bar. Five fixed tabs could only ever show four
 * destinations plus an overflow menu, so Account — and everything real behind
 * it — lived in a drop-up nobody found, while the bar itself spent 4rem of a
 * short viewport on every single screen whether it was wanted or not.
 *
 * A sheet costs one tap to open and gives the whole width back to the page. It
 * also has room to say what each destination *is*, which four 10px labels
 * under four glyphs never did.
 *
 * Every entry works signed out — the same rule the top nav follows (plan §4,
 * NEW 6). Signing in adds persistence, not access.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const panel = useRef(null)
  const toggle = useRef(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      // The toggle is excluded as well as the sheet. It lives in the header,
      // outside the panel, so a press on it counted as "outside" and closed
      // the sheet on mousedown — then its own click fired and toggled it
      // straight back open. Tapping the X appeared to do nothing at all.
      if (panel.current?.contains(event.target)) return
      if (toggle.current?.contains(event.target)) return

      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    // The sheet covers the page, so scrolling should move the sheet's own list
    // rather than the bracket behind it.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [open])

  return (
    // `lg:hidden`: wide screens use the Navbar, which hides itself below `lg`.
    <div className="lg:hidden">
      <header
        // Anchored to the top and blurred, so the page scrolls under it rather
        // than being pushed down by it. `env(safe-area-inset-top)` clears the
        // notch on an iPhone, where the first ~47px are behind the status bar.
        //
        // 3rem is the floor: the toggle inside is 2.75rem, the smallest
        // comfortable touch target, so a thinner bar would have to shrink the
        // one thing on it anybody presses.
        className="glass-chrome glass-chrome-top fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]"
      >
        <div className="flex h-12 items-center justify-between px-4">
          <Brand compact onClick={close} />

          <button
            ref={toggle}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            // 44px square: the minimum comfortable touch target, and square so
            // the icon swap does not shift anything beside it.
            className="text-base-content/70 hover:bg-base-content/8 hover:text-base-content -mr-2 grid h-11 w-11 place-items-center rounded-xl transition-colors"
          >
            {open ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />}
          </button>
        </div>
      </header>

      {open && <MobileMenu panelRef={panel} onClose={close} />}
    </div>
  )
}
