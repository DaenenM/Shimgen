// Shared axios instance for every API request. Used by src/api/endpoints.js.
// Request interceptor attaches the bearer token; response interceptor unwraps
// the error envelope into ApiError and refreshes an expired access token once.
// Concurrent 401s share one refresh promise so simultaneous requests don't
// each trigger a refresh and invalidate each other under token rotation.

import axios from 'axios'

import { API_BASE_URL } from '@/config/env'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

// Normalised failed request. Backend returns {error: {code, message, details}}
// (see backend/config/exceptions.py); `message` is for toasts, `details` for
// per-field errors.
export class ApiError extends Error {
  constructor({ message, code, details, status }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details ?? {}
    this.status = status
  }

  // Messages for one form field, or an empty array.
  fieldErrors(field) {
    return this.details[field] ?? []
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Wording for a response with no error envelope (unhandled 500, proxy 502/504).
function fallbackMessage(status) {
  if (status >= 500) return 'Something broke on our end. Try again in a moment.'
  if (status === 404) return 'That could not be found. It may have been deleted.'
  if (status === 413) return 'That is too large to upload.'
  return 'Something went wrong. Try again.'
}

// Shared across every 401 that arrives while a refresh is already running.
let refreshPromise = null

// Exchanges the refresh token for a new pair, at most once concurrently.
// Returns the new access token, or null if the session is over.
function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve(null)

  refreshPromise = axios
    // Bare axios call, not `api` — going through the instance would recurse.
    .post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
    .then(({ data }) => {
      setTokens({ access: data.access, refresh: data.refresh })
      return data.access
    })
    .catch(() => {
      // Refresh token expired, blacklisted, or forged.
      clearTokens()
      return null
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error

    // No response at all: offline, DNS failure, CORS rejection or timeout.
    if (!response) {
      // Distinguish timeout: host sleeps when idle, so the first request after
      // a quiet spell can outlast the 20s limit while the connection is fine.
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      throw new ApiError({
        message: timedOut
          ? 'The server took too long to respond. It may be starting up — try again in a moment.'
          : 'Could not reach the server. Check your connection.',
        code: timedOut ? 'timeout' : 'network_error',
        status: 0,
      })
    }

    const isAuthEndpoint = config?.url?.includes('/auth/token/')

    // `_retried` caps this at one retry per request.
    if (response.status === 401 && !config._retried && !isAuthEndpoint) {
      config._retried = true

      const token = await refreshAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        return api(config)
      }
    }

    // Only treat as a session expiry if a token was actually sent.
    const sessionEnded =
      response.status === 401 && !isAuthEndpoint && Boolean(config?.headers?.Authorization)

    const envelope = response.data?.error
    throw new ApiError({
      message: sessionEnded
        ? 'Your session has expired. Sign in again.'
        : (envelope?.message ?? fallbackMessage(response.status)),
      code: envelope?.code ?? 'error',
      details: envelope?.details,
      status: response.status,
    })
  },
)

// Paginated endpoints return `{ results }`; unpaginated ones return an array.
export const unwrapList = (data) => data?.results ?? data ?? []
