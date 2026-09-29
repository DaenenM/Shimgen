import { Select } from '@/components/ui/Select'

// Picks one name from a list — `Select` fed plain strings. Used by RulesPanel.jsx (team generator).
// `taken` greys out names picked elsewhere without removing/reordering them.
export function PlayerSelect({
  value,
  onChange,
  names,
  label,
  placeholder = 'Player',
  disabled = false,
  taken = [],
  onOpenChange,
}) {
  const options = names.map((name) => {
    const isTaken = name !== value && taken.includes(name)
    return { value: name, label: name, disabled: isTaken, hint: isTaken ? 'captain' : undefined }
  })

  return (
    <Select
      className="flex-1"
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      placeholder={placeholder}
      emptyText="No names yet."
      disabled={disabled}
      onOpenChange={onOpenChange}
    />
  )
}
