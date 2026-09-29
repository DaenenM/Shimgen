const CONTROL =
  'glass-inset w-full min-h-11 px-3 text-sm transition-colors ' +
  'focus:border-primary/50 focus:outline-none placeholder:text-base-content/35'

/**
 * Form controls, at one size.
 *
 * Inputs were written inline and ended up at three sizes with four different
 * corner radii — `input-sm rounded-lg` next to a default `input-bordered`, on
 * the same form. These wrap the DaisyUI classes so a control is described by
 * what it is rather than by how it should look.
 *
 * Everything here is at least 44px tall on touch, which is the smallest target
 * a thumb hits reliably. That is also why there is no `sm` size: a form filled
 * in on a phone at a table has no room for a control that needs aiming at.
 */
export function TextInput({ className = '', ...rest }) {
  return <input className={`${CONTROL} ${className}`} {...rest} />
}
