// Loads Google Identity Services on demand and renders its button.
// Used by GoogleSignInButton.jsx.
// Script only loads when the server reports Google sign-in as configured.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { auth } from '@/api/endpoints'
import { queryKeys } from '@/lib/queryClient'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

// Asks the server which sign-in methods this deployment supports.
function useAuthConfig() {
  return useQuery({
    queryKey: queryKeys.auth.config,
    queryFn: auth.config,
    staleTime: Infinity, // config only changes on deploy
    retry: false,
  })
}

// Injects the GIS script once per page, shared by every caller.
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()

  const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(script)
  })
}

// Renders Google's own button into `containerRef` (required by their branding terms) and hands
// the credential back via onCredential.
export function useGoogleButton({ containerRef, onCredential, onError, text = 'continue_with' }) {
  const { data: config } = useAuthConfig()
  const [ready, setReady] = useState(false)

  // Ref avoids re-initializing GIS (and redrawing the button) on every parent re-render.
  const callbackRef = useRef(onCredential)
  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  const enabled = Boolean(config?.google?.enabled && config?.google?.client_id)

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    let cancelled = false

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current) return

        window.google.accounts.id.initialize({
          client_id: config.google.client_id,
          callback: (response) => callbackRef.current(response.credential),
          auto_select: false, // one-tap prompt deliberately off
          cancel_on_tap_outside: true,
        })

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'left',
          width: 320,
        })

        setReady(true)
      })
      .catch((error) => onError?.(error.message))

    return () => {
      cancelled = true
    }
  }, [enabled, config, containerRef, text, onError])

  return { enabled, ready }
}
