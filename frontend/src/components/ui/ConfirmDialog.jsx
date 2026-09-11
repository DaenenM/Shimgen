import { AlertTriangle } from '@/components/icons'
import { useEffect, useRef } from 'react'

/**
 * A confirmation people actually read.
 *
 * Deleting a board or a bracket takes everyone's history with it, so it is
 * worth a real pause. This replaces the inline "Delete? [Delete] [Cancel]" row
 * that used to sit in the card — that put a destructive button one stray click
 * from where the list had just been, and read as debug UI rather than a
 * decision.
 *
 * Built on <dialog>, so the browser handles the focus trap, the backdrop and
 * Escape rather than this reimplementing all three badly.
 */
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
      // Escape and the backdrop both mean "no", and the browser fires close for
      // either — so cancelling is handled in one place rather than three.
      onClose={onCancel}
    >
      {/* `glass-raised`, like every other floating surface in the app. The
          destructive colouring stays — red icon tile, red confirm — because
          that is a deliberate difference from the other dialogs rather than an
          inconsistency with them. */}
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

      {/* DaisyUI's backdrop form: clicking outside submits it, which closes the
          dialog and runs onClose above. */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Cancel">close</button>
      </form>
    </dialog>
  )
}
