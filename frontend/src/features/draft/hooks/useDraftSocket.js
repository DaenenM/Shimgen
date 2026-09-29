import { useEffect, useRef } from 'react'

import { getAccessToken } from '@/api/tokens'
import { WS_BASE_URL } from '@/config/env'

// Live draft updates over WebSocket. Used by useDraftLobby.js.
// Chosen over polling: polling is slow enough for double-picks and wasteful when idle.
// `onUpdate` receives the same shape as the REST endpoint. Socket is read-only — picks
// still go through the REST endpoint, which owns the turn/permission checks.
export function useDraftSocket(tournamentId, onUpdate, { enabled = true } = {}) {
  // Ref avoids reconnecting the socket on every re-render with a new inline callback.
  const handler = useRef(onUpdate)

  useEffect(() => {
    handler.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!enabled || !tournamentId) return undefined

    let socket = null
    let retry = null
    let attempts = 0
    let closed = false

    function connect() {
      // Token goes in the query string (WebSocket handshakes can't set headers). Anonymous
      // is allowed through for unclaimed quick-start drafts.
      const token = getAccessToken()
      const url =
        `${WS_BASE_URL}/drafts/${tournamentId}/` +
        (token ? `?token=${encodeURIComponent(token)}` : '')

      socket = new WebSocket(url)

      socket.onopen = () => {
        attempts = 0
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'draft.update' && message.draft) {
            handler.current?.(message.draft)
          }
        } catch {
          // Unparseable frame — not worth tearing the socket down for.
        }
      }

      socket.onclose = (event) => {
        // 4403 = server refused this viewer; retrying can't help until permissions change.
        if (closed || event.code === 4403) return

        // Capped exponential backoff.
        attempts += 1
        const delay = Math.min(1000 * 2 ** (attempts - 1), 15000)
        retry = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      socket?.close(1000) // normal closure code, avoids server error logs
    }
  }, [tournamentId, enabled])
}
