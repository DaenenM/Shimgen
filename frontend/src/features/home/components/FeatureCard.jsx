/**
 * One selling point.
 *
 * The icon sits in its own tinted tile rather than loose above the heading: at
 * six cards the loose icons read as a scattered column of blue marks, where the
 * tiles give each card a consistent anchor.
 */
export function FeatureCard({ icon: Icon, title, body, delay = '' }) {
  return (
    <div
      className={`glass-panel hover:border-base-content/20 rise-in ${delay} p-5 transition-colors duration-200`}
    >
      <span className="bg-primary/15 text-primary mb-3 grid h-10 w-10 place-items-center rounded-xl">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-base-content/60 mt-1.5 text-sm">{body}</p>
    </div>
  )
}
