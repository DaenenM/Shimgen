import { Component } from 'react'

/**
 * Catches render errors so one broken component does not blank the whole app.
 *
 * Still a class: componentDidCatch has no hook equivalent, and React has not
 * shipped one. Wrap this around the router, and around anything that renders
 * untrusted or generated content.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
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
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="card bg-base-100 w-full max-w-md shadow-xl">
          <div className="card-body items-center text-center">
            <h2 className="card-title">Something broke</h2>
            <p className="text-base-content/70 text-sm">
              That is on us, not you. Reloading usually clears it.
            </p>

            {import.meta.env.DEV && (
              <pre className="bg-base-200 mt-2 max-h-40 w-full overflow-auto rounded p-3 text-left text-xs">
                {error.message}
              </pre>
            )}

            <div className="card-actions mt-4">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
