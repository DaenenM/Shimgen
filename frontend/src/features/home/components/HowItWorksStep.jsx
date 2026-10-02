// One numbered step. Used by HowItWorks.jsx.
export function HowItWorksStep({ number, title, body, delay = '' }) {
  return (
    <li className={`glass-panel rise-in ${delay} p-5`}>
      <span className="bg-primary text-primary-content grid h-8 w-8 place-items-center rounded-full text-sm font-bold">
        {number}
      </span>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="text-base-content/60 mt-1.5 text-sm">{body}</p>
    </li>
  )
}
