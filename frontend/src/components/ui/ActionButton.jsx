// The solid primary button used on glass panels (SettingsPanel, GeneratedTeams,
// TeamSetupPanel). Everything else on those pages is translucent, so this is
// the one opaque, unmissable "do the thing" button.

export const ACTION_BUTTON =
  'group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none'

// Hover sheen that sweeps across an ACTION_BUTTON. Needs its own element to
// animate, so it can't be baked into the class string above.
export function ActionSheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
    />
  )
}
