// Stores the JWT pair in localStorage. Used by src/api/client.js.
// Deliberate trade-off over an httpOnly cookie: simpler, mitigated by short
// access-token lifetimes and refresh rotation with server-side blacklisting.

const ACCESS_KEY = 'shim.access'
const REFRESH_KEY = 'shim.refresh'

// Safari in private mode throws on localStorage rather than returning null.
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
    // Storage unavailable; session won't survive a reload.
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing stored, or storage unavailable.
  }
}

export const getAccessToken = () => safeGet(ACCESS_KEY)
export const getRefreshToken = () => safeGet(REFRESH_KEY)

export function setTokens({ access, refresh }) {
  if (access) safeSet(ACCESS_KEY, access)
  // Only overwrite the refresh token when the server actually sends a new one.
  if (refresh) safeSet(REFRESH_KEY, refresh)
}

export function clearTokens() {
  safeRemove(ACCESS_KEY)
  safeRemove(REFRESH_KEY)
}
