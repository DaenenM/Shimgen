import { SECTION_LABELS } from '../../utils/layout'

// "Winners bracket" style pill above a section. Used by BracketSection.jsx and DoubleEliminationLayout.jsx.
export function SectionLabel({ section }) {
  return (
    <h3 className="mb-3">
      <span className="glass-inset text-base-content/70 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
        {SECTION_LABELS[section]}
      </span>
    </h3>
  )
}
