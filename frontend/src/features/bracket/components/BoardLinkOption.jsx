import { Check } from '@/components/icons'

export function BoardLinkOption({ label, hint, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-primary/12' : 'hover:bg-base-content/8'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${selected ? 'text-primary' : ''}`}>
          {label}
        </span>
        <span className="text-base-content/50 block truncate text-xs">{hint}</span>
      </span>

      {selected && <Check className="text-primary h-4 w-4 shrink-0" />}
    </button>
  )
}
