import { useEffect, useRef } from 'react'

import { AlertTriangle } from '@/components/icons'

// Confirmation modal for destructive actions. Shared UI primitive.
// Built on <dialog> so the browser handles focus trap, backdrop, and Escape.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  pending = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      // Escape and backdrop both fire native close, so cancel is handled once.
      onClose={onCancel}
    >
      <div className="glass-raised w-full max-w-md p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="bg-error/12 text-error grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <AlertTriangle className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            {message && <p className="text-base-content/70 mt-1 text-sm">{message}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-10"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-error text-error-content hover:bg-error/90 shadow-error/20 hover:shadow-error/30 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-10"
          >
            {pending && <span className="loading loading-spinner loading-sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>

      {/* DaisyUI backdrop: clicking outside submits, closing the dialog. */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Cancel">close</button>
      </form>
    </dialog>
  )
}
