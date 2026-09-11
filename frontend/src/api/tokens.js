postMessage /**
 * Where the JWT pair lives.
 *
 * localStorage is a deliberate trade-off. It is readable by any script on the
 * page, so an XSS bug exposes the tokens — the airtight alternative is an
 * httpOnly refresh cookie, which needs credentialed CORS and a CSRF story on
 * every mutating request. For a bracket app whose worst-case breach is someone
 * editing a game-night score, that complexity is not worth it. The mitigations
 * that matter are kept instead: short access-token lifetimes, refresh rotation
 * with blacklisting on the server, and no third-party scripts with DOM access.
 *
 * Every access goes through this module so swapping the strategy later touches
 * one file.
 */

const ACCESS_KEY = 'shim.access'
const REFRESH_KEY = 'shim.refresh'

/** Safari in private mode throws on localStorage rather than returning null. */
function safeGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the session simply will not survive a reload.
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to do: if we cannot write, there is nothing stored to clear.
  }
}

export const getAccessToken = () => safeGet(ACCESS_KEY)
export const getRefreshToken = () => safeGet(REFRESH_KEY)

export function setTokens({ access, refresh }) {
  if (access) safeSet(ACCESS_KEY, access)
  // Refresh rotation means the server returns a new refresh token on most
  // refreshes, but not all configurations do — only overwrite when one arrives.
  if (refresh) safeSet(REFRESH_KEY, refresh)
}

export function clearTokens() {
  safeRemove(ACCESS_KEY)
  safeRemove(REFRESH_KEY)
}
