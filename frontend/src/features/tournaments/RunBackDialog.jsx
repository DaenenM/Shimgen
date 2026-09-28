import { RotateCcw } from '@/components/icons'
import { useEffect, useRef } from 'react'

import { ErrorAlert } from '@/components/ui/ErrorAlert'

/**
 * "Run it back" — confirming a restage.
 *
 * Its own dialog rather than `ConfirmDialog`, which is built for destruction:
 * red button, warning triangle, "this cannot be undone". None of that is true
 * here — the original keeps every result, and this only adds. It still asks,
 * because it creates a whole tournament.
 *
 * Deliberately not on DaisyUI's `.modal`. That class carries a 300ms
 * visibility/background transition and its own translate and scale corrections,
 * which are applied to `.modal-box` — a class this does not use, since the
 * surface is the app's own glass. The result was a panel sitting low on the
 * screen that smeared away on close. Styling the <dialog> directly is both
 * fewer moving parts and the only way to get an instant dismissal.
 */
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
      // `m-auto` against `inset-0` is what centres a <dialog> in both axes.
      // The browser's own default is `margin: auto` on a positioned box, but
      // the UA stylesheet also sets `top`/`bottom` to the block-start edge,
      // which is what leaves an unstyled dialog sitting high — or, with a
      // library's overrides half-applied, low.
      className="fixed inset-0 m-auto max-h-fit w-[calc(100%-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-transparent"
      onClose={onCancel}
      // Clicking the backdrop cancels. The dialog element itself fills the
      // viewport only as far as its own box, so a click landing on it rather
      // than on the panel inside is a click outside the panel.
      onMouseDown={(event) => {
        if (event.target === ref.current) onCancel()
      }}
    >
      {/* Centred rather than an icon-beside-text row. The icon tile against a
          two-line paragraph left three different left edges and no alignment
          anywhere — the tile's, the heading's, and the text's. A single centred
          column has one axis, which is what makes a small card read as composed
          rather than assembled.

          One padding value throughout, and every gap a multiple of it, so the
          vertical rhythm is even top to bottom. */}
      <div className="glass-raised flex flex-col items-center gap-4 p-6 text-center">
        <span className="bg-success/12 text-success grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <RotateCcw className="h-5 w-5" />
        </span>

        <div className="space-y-1.5">
          <h3 className="text-lg leading-tight font-bold tracking-tight">Run it back?</h3>
          {/* `text-sm` rather than `text-xs`: this is the sentence explaining
              what the button does, and it was set smaller than the buttons
              underneath it. Balanced wrapping keeps two lines even rather than
              leaving one word stranded. */}
          <p className="text-base-content/70 text-sm text-balance">
            A fresh bracket with the same entrants, freshly paired
            {tournament?.feeds_stats_board ? ', counting towards the same board' : ''}.
          </p>
          {/* The name on its own line. Inlined into the sentence it pushed the
              paragraph to three ragged lines and buried the one piece of the
              text that changes. */}
          {tournament?.title && (
            <p className="text-base-content/50 truncate text-xs">
              {tournament.title} keeps its results
            </p>
          )}
        </div>

        <ErrorAlert compact className="w-full">
          {error}
        </ErrorAlert>

        {/* Full width and equal halves. Two shrink-wrapped buttons pushed right
            left a ragged bottom edge on a card this narrow; splitting the row
            gives the panel a base to sit on.

            Colour and border on hover, nothing that moves — a panel that has
            just appeared under the cursor should not also shift under it. */}
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
