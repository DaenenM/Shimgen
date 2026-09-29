import { Component } from 'react'
import { useLocation } from 'react-router-dom'

import { AlertTriangle, RotateCcw } from '@/components/icons'

// Catches render errors so one broken component doesn't blank the whole app.
// Must be a class (componentDidCatch has no hook equivalent). Used by App.jsx
// (outermost) and RouteErrorBoundary below.
// Pass `resetKey` to clear the error when it changes (e.g. route path);
// without it the error persists until reload.
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error, info) {
    // TODO: send to an error reporter once one is wired up.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      // Hand-built markup, not EmptyState/Button/<Link>: this can render
      // outside the router, so those would throw here too.
      <div className="glass-backdrop flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="glass-panel w-full max-w-md">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="bg-error/12 text-error grid h-12 w-12 place-items-center rounded-2xl">
              <AlertTriangle className="h-6 w-6" />
            </span>

            <div>
              <h2 className="text-lg font-bold tracking-tight">Something broke</h2>
              <p className="text-base-content/60 mt-1.5 text-sm">
                That is on us, not you. Reloading usually clears it.
              </p>
            </div>

            {import.meta.env.DEV && (
              // Dev only — a stack trace means nothing to a real user.
              <pre className="glass-inset text-base-content/70 max-h-40 w-full overflow-auto p-3 text-left font-mono text-xs">
                {error.message}
              </pre>
            )}

            <button
              className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 mt-1 flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
              onClick={() => window.location.reload()}
            >
              <RotateCcw className="h-4 w-4" />
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}

// ErrorBoundary that resets on navigation, so leaving a broken page recovers
// it instead of leaving the fallback stuck. Used by RootLayout.jsx (must be
// inside the router, since it calls useLocation).
export function RouteErrorBoundary({ children }) {
  const location = useLocation()

  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
}
