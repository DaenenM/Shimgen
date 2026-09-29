// A styled <input>, one consistent size across the app (44px min height for
// touch targets). Used by NewBoardForm and elsewhere forms need a plain text
// field without the label wrapper Field.jsx provides.

const CONTROL =
  'glass-inset w-full min-h-11 px-3 text-sm transition-colors ' +
  'focus:border-primary/50 focus:outline-none placeholder:text-base-content/35'

export function TextInput({ className = '', ...rest }) {
  return <input className={`${CONTROL} ${className}`} {...rest} />
}
