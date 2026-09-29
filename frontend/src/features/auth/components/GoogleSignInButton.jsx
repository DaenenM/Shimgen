import { useRef, useState } from 'react'

import { useGoogleButton } from '../hooks/useGoogleSignIn'

// "Continue with Google" button plus divider.
// Used by LoginForm.jsx, RegisterForm.jsx.
// Renders nothing when the server has no Google client ID configured.
export function GoogleSignInButton({ onCredential, onError, text = 'continue_with' }) {
  const containerRef = useRef(null)
  const [failed, setFailed] = useState(null)

  const { enabled, ready } = useGoogleButton({
    containerRef,
    onCredential,
    onError: (message) => {
      setFailed(message)
      onError?.(message)
    },
    text,
  })

  if (!enabled) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-base-300 h-px flex-1" />
        <span className="text-base-content/40 text-xs tracking-wide uppercase">or</span>
        <span className="bg-base-300 h-px flex-1" />
      </div>

      <div className="flex min-h-[44px] justify-center">
        {/* Google renders its own button here; skeleton avoids layout jump while it loads. */}
        <div ref={containerRef} />
        {!ready && !failed && <span className="skeleton h-11 w-full max-w-[320px] rounded" />}
      </div>

      {failed && <p className="text-error text-center text-xs">{failed}</p>}
    </div>
  )
}
