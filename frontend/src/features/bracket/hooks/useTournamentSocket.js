import { useEffect, useRef } from 'react'

import { getAccessToken } from '@/api/tokens'
import { WS_BASE_URL } from '@/config/env'

// Live bracket updates over a WebSocket: a co-host's result on one device
// refetches on every other open viewer instead of waiting for a manual reload.
// Used by useBracketReporting.js and useSpectatorBracket.js.
//
// The server sends `{"type": "tournament.update"}` with no payload; `onUpdate`
// decides what to refetch, since a host and a spectator see different serializations.
// Read-only — reporting goes through REST, which owns permissions and advancement.
export function useTournamentSocket(tournamentId, onUpdate, { enabled = true } = {}) {
  // Ref, not state: a new inline callback each render must not tear down and reconnect the socket.
  const handler = useRef(onUpdate)

  // Assigned in an effect, not during render — a render-phase write isn't safe under concurrent rendering.
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
      // No headers on a WebSocket handshake, so the token goes in the query string.
      // Anonymous is allowed through — brackets are publicly spectatable.
      const token = getAccessToken()
      const url =
        `${WS_BASE_URL}/tournaments/${tournamentId}/` +
        (token ? `?token=${encodeURIComponent(token)}` : '')

      socket = new WebSocket(url)

      socket.onopen = () => {
        attempts = 0
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'tournament.update') handler.current?.()
        } catch {
          // Unparseable frame; not worth tearing the socket down for.
        }
      }

      socket.onclose = (event) => {
        // 4403: the consumer refused this viewer — retrying can't succeed.
        if (closed || event.code === 4403) return

        // Capped backoff: don't hammer a reconnect, but still recover quickly.
        attempts += 1
        const delay = Math.min(1000 * 2 ** (attempts - 1), 15000)
        retry = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      // 1000 = normal closure, so the server doesn't log it as an error.
      socket?.close(1000)
    }
  }, [tournamentId, enabled])
}
