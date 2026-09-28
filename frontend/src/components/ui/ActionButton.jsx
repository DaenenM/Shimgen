/**
 * The solid action button on the glass form pages.
 *
 * Everything else on those pages is glass, so the actions that move you forward
 * are the one opaque thing on it — make them translucent too and the hierarchy
 * flattens out. Shared so "Generate teams", "Put these teams in a bracket" and
 * "Create tournament" cannot drift apart.
 *
 * Hover matches the landing page: a small lift, the glow spreading a little,
 * and `ActionSheen` crossing once. The shadow is deliberately restrained —
 * `shadow-md` rising to `shadow-lg`, not `lg` to `xl` — because these sit
 * inside a glass panel rather than on open page, and a heavy drop shadow in
 * there reads as the button floating off the surface it belongs to.
 */
export const ACTION_BUTTON =
  'group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none'

/**
 * The light that crosses a solid action button on hover.
 *
 * Its own component because the effect needs a child element to translate, so
 * a class string alone cannot carry it. Pure transform, so it composites
 * without repainting the label underneath.
 */
export function ActionSheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
    />
  )
}
