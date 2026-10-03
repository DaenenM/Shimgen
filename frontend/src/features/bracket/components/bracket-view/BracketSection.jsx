import { useDragScroll } from '@/hooks/useDragScroll'

import { sectionColumns } from '../../utils/layout'
import { RoundColumns } from './RoundColumns'
import { RoundHeadings } from './RoundHeadings'
import { SectionLabel } from './SectionLabel'

// One standalone bracket section with its own scroller. Used by BracketView.jsx.
export function BracketSection({ section, matches, showHeading, canReport, onReport, onClear }) {
  // Drag to pan — a deep bracket is wider than any screen even after shrinking.
  const scroller = useDragScroll()

  const layout = sectionColumns(matches, section)
  if (layout.columns.length === 0) return null

  return (
    <section>
      {showHeading && <SectionLabel section={section} />}

      <div ref={scroller} className="overflow-x-auto pb-2">
        <RoundHeadings {...layout} section={section} />
        <RoundColumns
          {...layout}
          section={section}
          canReport={canReport}
          onReport={onReport}
          onClear={onClear}
        />
      </div>
    </section>
  )
}
