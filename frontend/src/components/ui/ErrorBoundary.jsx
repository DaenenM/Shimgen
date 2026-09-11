import { AlertTriangle, RotateCcw } from '@/components/icons'
import { Component } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Catches render errors so one broken component does not blank the whole app.
 *
 * Still a class: componentDidCatch has no hook equivalent, and React has not
 * shipped one. Wrap this around the router, and around anything that renders
 * untrusted or generated content.
 *
 * Pass a `resetKey` to clear a caught error when something meaningful changes —
 * `RouteErrorBoundary` below does that with the current path. Without one the
 * boundary holds its error until the page is reloaded, which is the right
 * behaviour for the outermost boundary: if a provider threw, there is nothing
 * left to recover into.
 */
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
    // Replace with a real error reporter when one is wired up. Logging here
    // rather than swallowing it keeps the stack visible in development.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      // Deliberately hand-built rather than reusing EmptyState or Button: the
      // outermost boundary is mounted *outside* RouterProvider, so anything
      // that renders a <Link> throws here — and a fallback that crashes is no
      // fallback at all. `window.location` for the same reason: navigating
      // needs the router this may be standing in for.
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
              // Development only: the message is for whoever is building this,
              // and a stack trace shown to a player is noise they cannot act on.
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

/**
 * An ErrorBoundary that clears itself on navigation.
 *
 * A boundary holds its error state forever otherwise, so navigating away from
 * a page that threw swapped the URL but kept rendering the fallback — the app
 * looked frozen on the broken page until a hard reload.
 *
 * Only usable inside the router, which is why it is separate: the outermost
 * boundary in App sits above RouterProvider so it can catch a provider
 * throwing, and calling useLocation there is an error.
 */
export function RouteErrorBoundary({ children }) {
  const location = useLocation()

  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
}
