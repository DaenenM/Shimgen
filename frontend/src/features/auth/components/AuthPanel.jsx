// Centered glass panel wrapping the sign-in and sign-up forms.
// Used by LoginPage.jsx, RegisterPage.jsx.
export function AuthPanel({ children }) {
  return (
    <div className="glass-backdrop mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="glass-panel rise-in w-full">{children}</div>
    </div>
  )
}
