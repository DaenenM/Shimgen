// One entry in the "Also built in" list. Used by ExtrasList.jsx.
export function ExtraItem({ icon: Icon, title, body }) {
  return (
    <li className="flex gap-3">
      <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-base-content/60 mt-1 text-sm">{body}</p>
      </div>
    </li>
  )
}
