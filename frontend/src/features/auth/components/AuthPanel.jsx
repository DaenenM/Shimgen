/**
 * The centred glass panel the sign-in and sign-up forms sit in.
 *
 * One panel, one movement. A stagger inside a login form would animate the
 * fields a visitor is about to type into, which delays the thing they came to
 * do for the sake of decoration.
 */
export function AuthPanel({ children }) {
  return (
    <div className="glass-backdrop mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="glass-panel rise-in w-full">{children}</div>
    </div>
  )
}
