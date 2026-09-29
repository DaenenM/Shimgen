import { Info } from '@/components/icons'

/**
 * Said before the host commits, rather than after.
 *
 * A red edge rather than the quiet glass box it used to be: sitting among the
 * settings it read as one more hint and was skipped, and a bracket full of byes
 * is the thing hosts then think is broken. The text stays the body colour — the
 * border draws the eye, the words still have to be comfortable to read.
 */
export function ByeWarning({ warning }) {
  return (
    <div
      role="note"
      className="border-error/60 bg-error/8 flex items-start gap-2.5 rounded-xl border p-3 text-sm"
    >
      <Info className="text-error mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>{warning.message}</p>
        <p className="text-base-content/60 mt-0.5 text-xs">{warning.hint}</p>
      </div>
    </div>
  )
}
