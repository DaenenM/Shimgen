import { useEffect, useRef } from 'react'

import { getAccessToken } from '@/api/tokens'
import { WS_BASE_URL } from '@/config/env'

/**
 * Live draft updates over a WebSocket.
 *
 * A captain draft is the one screen in the app where several people watch the
 * same state change every few seconds, and polling served it badly in both
 * directions: 3 seconds is long enough that two people pick the same player,
 * and it is a request per viewer per tick for a page that is idle most of its
 * life.
 *
 * `onUpdate` receives the draft payload — the same shape the REST endpoint
 * returns — so the caller writes it straight into the query cache and every
 * viewer converges on one server-rendered truth.
 *
 * The socket is read-only. Picking still goes through the REST endpoint, which
 * owns the turn check and the permission rules; sending picks up the socket
 * would mean a second implementation of both.
 */
export function useDraftSocket(tournamentId, onUpdate, { enabled = true } = {}) {
  // Held in a ref so a re-render with a new inline callback does not tear the
  // socket down and reconnect — which, with a callback defined in the component
  // body, would be every render.
  const handler = useRef(onUpdate)

  // Assigned in an effect rather than during render: a render-phase ref write
  // is not safe under concurrent rendering, where a render can be thrown away
  // — and the socket effect below would then hold a callback from a render
  // that never committed.
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
      // in the query string. Anonymous is allowed through: an unclaimed
      // quick-start draft has no account behind it and still needs its lobby.
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
          // A frame we cannot parse is not worth tearing the socket down for.
        }
      }

      socket.onclose = (event) => {
        // 4403 is the consumer refusing this viewer. Retrying would hammer the
        // server with a handshake that cannot succeed until permissions change.
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
