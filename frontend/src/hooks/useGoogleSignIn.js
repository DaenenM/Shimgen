/**
 * Google Identity Services, loaded on demand.
 *
 * The GIS script is only injected when the server says Google sign-in is
 * configured, so a deployment without a client ID never loads a third-party
 * script — and never shows a button that cannot work.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '@/api/client'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Ask the server which sign-in methods this deployment supports. */
export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth', 'config'],
    queryFn: () => api.get('/auth/config/').then((r) => r.data),
    // Configuration changes on deploy, not during a session.
    staleTime: Infinity,
    retry: false,
  })
}

/** Inject the GIS script once per page, shared by every caller. */
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

/**
 * Render Google's button into `containerRef` and hand the credential back.
 *
 * Google's own button element is used rather than a custom one: their branding
 * terms require it, and it handles the popup, the account chooser and every
 * locale for free.
 */
export function useGoogleButton({ containerRef, onCredential, onError, text = 'continue_with' }) {
  const { data: config } = useAuthConfig()
  const [ready, setReady] = useState(false)

  // Held in a ref so re-rendering the parent does not re-initialise GIS, which
  // would tear down and redraw the button on every keystroke in the form.
  // Assigned in an effect rather than during render: a ref write during render
  // is not guaranteed to survive a discarded render pass.
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
          // Google's one-tap prompt is deliberately off: it appears unbidden
          // over the page, and on a sign-in form the explicit button is
          // clearer about what is about to happen.
          auto_select: false,
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

/** Exchange a Google credential for this application's own token pair. */
export function useGoogleExchange() {
  return useCallback(
    (credential) => api.post('/auth/google/', { credential }).then((r) => r.data),
    [],
  )
}
