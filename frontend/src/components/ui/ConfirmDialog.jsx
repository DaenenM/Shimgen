import { AlertTriangle } from 'lucide-react'
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
      <div className="modal-box border-base-300 max-w-md border">
        <div className="flex items-start gap-3">
          <span className="bg-error/10 text-error grid h-10 w-10 shrink-0 place-items-center rounded-full">
            <AlertTriangle className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h3 className="text-lg font-bold">{title}</h3>
            {message && <p className="text-base-content/70 mt-1 text-sm">{message}</p>}
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button className="btn btn-error gap-2" onClick={onConfirm} disabled={pending}>
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
