import { Check } from '@/components/icons'

// Shows whether reported results have reached the server (results are
// batched, so there's a lag). Used by TournamentHeader.jsx.
// States: idle (nothing reported yet), saving (queued), saved (persists, doesn't fade).
export function SaveIndicator({ state }) {
  if (state === 'idle') return null

  const saving = state === 'saving'

  return (
    <div
      role="status"
      aria-live="polite"
      // Sized like the buttons beside it, but not a <button> — nothing to press here.
      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors duration-300 ${
        saving
          ? 'border-base-content/12 bg-base-content/5 text-base-content/60'
          : 'border-success/30 bg-success/10 text-success'
      }`}
    >
      <span className="relative grid h-4 w-4 shrink-0 place-items-center">
        {/* Both marks stay mounted and cross-fade, to avoid a layout jump on swap. */}
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
