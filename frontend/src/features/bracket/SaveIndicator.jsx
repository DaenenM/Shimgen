import { Check } from '@/components/icons'

/**
 * Whether this bracket's results have reached the server.
 *
 * Results are batched, so there is a window where the bracket on screen is
 * ahead of what is stored. That window is invisible without something saying
 * so, and "did that save?" is the question a host asks when the night's record
 * matters.
 *
 * Three states, and the third is the point:
 *
 *   idle    nothing reported yet this visit — nothing to claim
 *   saving  clicks are queued and on their way
 *   saved   everything reported is stored, and this stays put
 *
 * The checkmark persisting rather than fading is deliberate. A confirmation
 * that disappears is one the host has to catch; one that stays is a standing
 * answer they can glance at any time during the night.
 *
 * Shaped like the buttons beside it — same height, same border, same radius —
 * so the header reads as one row of controls rather than a button strip with
 * a status message wedged into it. It is not interactive, so it renders as a
 * status region rather than a button: there is nothing here to press.
 */
export function SaveIndicator({ state }) {
  if (state === 'idle') return null

  const saving = state === 'saving'

  return (
    <div
      role="status"
      aria-live="polite"
      // btn-sm's own metrics, so it lines up with Permissions and Share without
      // inheriting a button's hover and active states.
      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors duration-300 ${
        saving
          ? 'border-base-300 bg-base-100 text-base-content/60'
          : 'border-success/30 bg-success/10 text-success'
      }`}
    >
      <span className="relative grid h-4 w-4 shrink-0 place-items-center">
        {/* Both marks are always mounted and cross-fade. Swapping the element
            instead made the row jump by a pixel as the spinner's box gave way
            to the icon's. */}
        <span
          className={`loading loading-spinner loading-xs absolute transition-opacity duration-200 ${
            saving ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />
        <Check
          className={`absolute h-4 w-4 transition-all duration-300 ease-out ${
            saving ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
          }`}
          aria-hidden="true"
        />
      </span>

      <span>{saving ? 'Saving' : 'Saved'}</span>
    </div>
  )
}
