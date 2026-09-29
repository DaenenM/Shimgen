import { Info } from '@/components/icons'

// Bye warning shown before creating the tournament. Used by SettingsPanel.jsx.
// Red border draws the eye (a quiet glass box got skipped); body-colour text stays readable.
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
