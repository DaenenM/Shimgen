import { useEffect, useRef } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'

// How the lifted name swings. Tuned by feel, in real units so it behaves the
// same at 60Hz and 144Hz.
const MAX_TILT = 9 // degrees — approached, never hit (see `tanh` below)
const SATURATION = 1200 // px/s of sideways speed that gives ~76% of MAX_TILT
const VELOCITY_SMOOTHING = 0.07 // seconds: the window the pointer's speed is averaged over
const STIFFNESS = 170 // spring pull toward the target lean, per second²
const DAMPING = 17 // resistance — ζ ≈ 0.65: one soft overshoot, then still
const MAX_STEP = 1 / 30 // seconds: a hitch longer than this is not simulated as one leap

/**
 * The name in the air, swinging with the pointer.
 *
 * Carried like something held by its top edge: moving right drags the base
 * behind it, so the leading (right) end dips and the trailing end lifts —
 * a clockwise lean — and moving left leans it the other way. Only sideways
 * speed counts; straight up or down leaves it level.
 *
 * What makes it smooth rather than twitchy:
 *
 *  - Speed is sampled once per frame and averaged over ~70ms, not taken from
 *    each pointer event. Mice report at their own rate (125–1000Hz), out of
 *    step with the display, so per-event speeds alternate between a spike and
 *    nothing — which is exactly what read as jitter.
 *  - The spring is integrated over real elapsed time, so its feel does not
 *    change with the refresh rate or a dropped frame.
 *  - The lean eases toward its maximum (`tanh`) instead of hitting a hard cap,
 *    so a fast flick leans further without ever slamming into a limit.
 *  - Damped just under critical: it glides into a lean and settles with one
 *    soft overshoot when the pointer stops, which is what gives it weight.
 *
 * Writes `rotate` straight to the element each frame rather than through
 * React state, which would re-render the overlay sixty-plus times a second.
 * `rotate`, not `transform`: `pill-lift` animates `transform` (the lift's
 * scale), and an animation outranks an inline style on the same property —
 * the two separate properties compose instead.
 */
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

    // Only records where the pointer is; the frame loop decides what it means.
    // pointermove covers mouse and touch alike, whichever sensor started the
    // drag.
    const onMove = (event) => {
      pointerX = event.clientX
    }

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, MAX_STEP)
      last = now

      if (dt > 0) {
        if (pointerX !== null && sampledX !== null) {
          const raw = (pointerX - sampledX) / dt
          // Exponential smoothing with a time constant, so the averaging window
          // is the same length whatever the frame rate.
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
      // `will-change` keeps the chip on its own compositor layer for the whole
      // drag, so each frame's new angle is a cheap composite, not a repaint of
      // the blurred glass.
      className="pill-lift glass-raised cursor-grabbing rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg will-change-[rotate,transform]"
    >
      {label}
    </div>
  )
}
