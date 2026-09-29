// Typed wrappers around Vite's env vars, so defaults live in one place.
// Only VITE_-prefixed vars reach the client — never put secrets here.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

// Matches the page's own protocol (ws:// on http, wss:// on https).
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
