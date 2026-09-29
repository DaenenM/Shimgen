import { useEffect, useRef } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'

// Tilt physics tuning, in real units so feel is consistent across refresh rates.
const MAX_TILT = 9 // degrees, approached via tanh, never hit
const SATURATION = 1200 // px/s of sideways speed giving ~76% of MAX_TILT
const VELOCITY_SMOOTHING = 0.07 // seconds, pointer speed averaging window
const STIFFNESS = 170 // spring pull toward target lean, per second^2
const DAMPING = 17 // spring resistance, zeta ~0.65 (slight overshoot then settle)
const MAX_STEP = 1 / 30 // seconds, caps simulated step on a frame hitch

// Name chip that swings/tilts while being dragged, following pointer velocity.
// Used by TeamDragProvider.jsx's DragOverlay.
// Leans clockwise moving right, counter-clockwise moving left; vertical motion has no effect.
// Writes `rotate` directly to the element per frame (not React state) to avoid re-render cost;
// uses the `rotate` CSS property rather than `transform` so it composes with pill-lift's scale animation.
export function LiftedMember({ label }) {
  const el = useRef(null)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    if (reducedMotion) return

    let pointerX = null
    let sampledX = null
    let velocity = 0
    let angle = 0
    let spin = 0
    let last = performance.now()
    let frame

    // Records pointer position only; the frame loop derives velocity from it.
    const onMove = (event) => {
      pointerX = event.clientX
    }

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, MAX_STEP)
      last = now

      if (dt > 0) {
        if (pointerX !== null && sampledX !== null) {
          const raw = (pointerX - sampledX) / dt
          // Exponential smoothing keeps the averaging window frame-rate independent.
          velocity += (raw - velocity) * (1 - Math.exp(-dt / VELOCITY_SMOOTHING))
        }
        sampledX = pointerX

        const target = MAX_TILT * Math.tanh(velocity / SATURATION)
        spin += (STIFFNESS * (target - angle) - DAMPING * spin) * dt
        angle += spin * dt

        if (el.current) el.current.style.rotate = `${angle.toFixed(3)}deg`
      }

      frame = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove)
    frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [reducedMotion])

  return (
    <div
      ref={el}
      // will-change keeps this on its own compositor layer so per-frame rotation is a cheap composite.
      className="pill-lift glass-raised cursor-grabbing rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg will-change-[rotate,transform]"
    >
      {label}
    </div>
  )
}
