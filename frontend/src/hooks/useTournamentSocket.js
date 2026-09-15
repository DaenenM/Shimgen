import { useEffect, useRef } from 'react'

import { getAccessToken } from '@/api/tokens'
import { WS_BASE_URL } from '@/config/env'

/**
 * Live bracket updates over a WebSocket.
 *
 * The problem this solves: a co-host reports a result on their phone and the
 * host's laptop shows the old bracket until they navigate away and back. The
 * detail query has no polling and a two-minute freshness window, so nothing
 * asks the server again once the page has loaded.
 *
 * The server sends a nudge — `{"type": "tournament.update"}` with no payload —
 * and `onUpdate` decides what to refetch. That keeps each viewer's own
 * serialization: a host and a spectator are entitled to different views of the
 * same bracket, and pushing one blob to both would either leak or under-serve.
 *
 * Read-only. Reporting still goes through the REST endpoints, which own the
 * permission rules and the advancement logic.
 */
export function useTournamentSocket(tournamentId, onUpdate, { enabled = true } = {}) {
  // Held in a ref so a re-render with a new inline callback does not tear the
  // socket down and reconnect — which, with a callback defined in the component
  // body, would be every render.
  const handler = useRef(onUpdate)

  // Assigned in an effect rather than during render: a render-phase ref write
  // is not safe under concurrent rendering, where a render can be discarded and
  // the effect below would then hold a callback that never committed.
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
      // Browsers cannot set headers on a WebSocket handshake, so the token goes
      // in the query string. Anonymous is allowed through: a bracket is
      // publicly spectatable and most viewers of one have no account.
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
          // A frame we cannot parse is not worth tearing the socket down for.
        }
      }

      socket.onclose = (event) => {
        // 4403 is the consumer refusing this viewer. Retrying would hammer the
        // server with a handshake that cannot succeed.
        if (closed || event.code === 4403) return

        // Backoff, capped: a laptop closed overnight should not come back to a
        // reconnect every 200ms, and a server restart should still be picked up
        // within a few seconds.
        attempts += 1
        const delay = Math.min(1000 * 2 ** (attempts - 1), 15000)
        retry = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      // 1000 is a normal closure, so the server does not log it as an error.
      socket?.close(1000)
    }
  }, [tournamentId, enabled])
}
