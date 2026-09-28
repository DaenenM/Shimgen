import { X } from '@/components/icons'

/**
 * Who is on the team right now.
 *
 * The roster checklist only shows the roster, so a name typed in that is not
 * saved there had no representation at all — it was on the team with nothing
 * to click to take it back off. These pills are the one place every member
 * appears, whichever kind they are.
 */
export function MemberPills({ pills, onRemove }) {
  if (pills.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className="bg-primary/15 text-primary inline-flex h-7 items-center gap-1 rounded-full py-0 pr-1 pl-2.5 text-sm font-medium"
        >
          <span className="max-w-[10rem] truncate">{pill.label}</span>
          <button
            type="button"
            onClick={() => onRemove(pill)}
            aria-label={`Remove ${pill.label} from the team`}
            title={`Remove ${pill.label}`}
            className="hover:bg-error/20 hover:text-error grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-150"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
