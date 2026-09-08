/**
 * Typed access to Vite's build-time environment.
 *
 * Only variables prefixed VITE_ are exposed to the client, and every one of them
 * ends up readable in the shipped bundle — never put a secret here.
 *
 * Reading them through this module rather than touching `import.meta.env`
 * directly keeps the defaults in one place and gives tests a single seam.
 */

/** Base URL for API requests. Relative by default so Vite's dev proxy handles it. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * Origin for WebSocket connections.
 *
 * Derived from the page's own origin so it follows http/https correctly: a
 * secure page cannot open an insecure ws:// socket, and hardcoding either
 * scheme breaks one of the two environments.
 */
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export const IS_DEV = import.meta.env.DEV
export const IS_PROD = import.meta.env.PROD
