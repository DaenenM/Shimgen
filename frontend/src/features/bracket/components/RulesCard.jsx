// A tournament's house rules, beside the bracket. Used by TournamentDetailPage.jsx.
export function RulesCard({ rules }) {
  return (
    <aside>
      <div className="glass-panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Rules</h3>
        <p className="text-base-content/70 text-xs whitespace-pre-wrap">{rules}</p>
      </div>
    </aside>
  )
}
