import { Select } from './Select'

/**
 * Pick one name from a list of names — `Select`, fed plain strings.
 *
 * Used by the team generator's rules, where it picks the two players a rule is
 * about. `taken` greys out names chosen elsewhere without removing them: a list
 * that reshuffles as you pick moves the option under the cursor, and when this
 * is used once per team every pick would rearrange every other dropdown.
 */
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
