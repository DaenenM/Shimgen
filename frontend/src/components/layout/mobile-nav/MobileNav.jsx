import { useEffect, useRef, useState } from 'react'

import { Menu, X } from '@/components/icons'

import { Brand } from '../Brand'
import { MobileMenu } from './MobileMenu'

// Phone navigation: top bar with a hamburger, plus the sheet it opens. Used by RootLayout.jsx.
// Replaced a bottom tab bar to give the page its width back and room for labels.
// Every entry works signed out (plan §4, NEW 6).
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const panel = useRef(null)
  const toggle = useRef(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      // Exclude the toggle too — otherwise mousedown closes the sheet, then
      // its own click reopens it, so tapping X appears to do nothing.
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

    // Lock body scroll so the sheet's own list scrolls, not the page behind it.
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
        // Fixed + blurred so the page scrolls under it. Safe-area inset clears the iPhone notch.
        // 3rem height is the floor set by the 2.75rem touch target inside.
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
            // 44px square touch target; square so the icon swap doesn't shift layout.
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
