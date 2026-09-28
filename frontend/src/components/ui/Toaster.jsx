import { AlertTriangle, X } from '@/components/icons'
import { useSyncExternalStore } from 'react'

import { dismissToast, getToasts, subscribeToasts } from '@/lib/toast'

/**
 * Where failures without a home of their own are shown.
 *
 * Mounted once at the app root. Bottom-centre so it clears the bracket's
 * controls on a phone, and `aria-live` so a screen reader announces a failed
 * save rather than leaving it to be noticed visually.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="border-error/30 bg-base-100 text-error rise-in pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className="text-base-content/50 hover:text-base-content -m-1 rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
