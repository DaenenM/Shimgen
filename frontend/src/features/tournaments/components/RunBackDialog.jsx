import { useEffect, useRef } from 'react'

import { RotateCcw } from '@/components/icons'
import { ErrorAlert } from '@/components/ui/ErrorAlert'

// Confirms restaging a tournament ("run it back"). Used by TournamentsPage.jsx.
// Its own dialog rather than ConfirmDialog, since restaging isn't destructive
// (no red button/warning). Styles the native <dialog> directly rather than
// DaisyUI's .modal, whose built-in transition doesn't work with our glass surface.
export function RunBackDialog({ tournament, pending, error, onConfirm, onCancel }) {
  const ref = useRef(null)
  const open = Boolean(tournament)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // m-auto + inset-0 centres a <dialog> in both axes.
      className="fixed inset-0 m-auto max-h-fit w-[calc(100%-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-transparent"
      onClose={onCancel}
      // Clicking the backdrop cancels. The dialog element itself fills the
      // viewport only as far as its own box, so a click landing on it rather
      // than on the panel inside is a click outside the panel.
      onMouseDown={(event) => {
        if (event.target === ref.current) onCancel()
      }}
    >
      <div className="glass-raised flex flex-col items-center gap-4 p-6 text-center">
        <span className="bg-success/12 text-success grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <RotateCcw className="h-5 w-5" />
        </span>

        <div className="space-y-1.5">
          <h3 className="text-lg leading-tight font-bold tracking-tight">Run it back?</h3>
          <p className="text-base-content/70 text-sm text-balance">
            A fresh bracket with the same entrants, freshly paired
            {tournament?.feeds_stats_board ? ', counting towards the same board' : ''}.
          </p>
          {tournament?.title && (
            <p className="text-base-content/50 truncate text-xs">
              {tournament.title} keeps its results
            </p>
          )}
        </div>

        <ErrorAlert compact className="w-full">
          {error}
        </ErrorAlert>

        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="glass-raised hover:border-base-content/30 hover:bg-base-content/8 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-primary text-primary-content hover:bg-primary/85 shadow-primary/20 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Run it back
          </button>
        </div>
      </div>
    </dialog>
  )
}
