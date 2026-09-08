/**
 * The single axios instance every request goes through.
 *
 * Two interceptors do the work:
 *
 *  - request:  attaches the bearer token, when there is one.
 *  - response: unwraps the backend's error envelope into an ApiError, and
 *              transparently refreshes an expired access token once.
 *
 * The refresh path is the fiddly part. A page that fires six queries at once
 * will get six 401s within milliseconds of the access token expiring; naively
 * refreshing per response would fire six refreshes, and with rotation enabled
 * on the server the first would invalidate the other five and log the user out.
 * So a single in-flight refresh promise is shared by every waiting request.
 */

import axios from 'axios'

import { API_BASE_URL } from '@/config/env'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

/**
 * A failed request, normalised.
 *
 * The backend returns every error as {error: {code, message, details}}
 * (see backend/config/exceptions.py), so components can rely on `message` for a
 * toast and `details` for per-field errors without inspecting status codes.
 */
export class ApiError extends Error {
  constructor({ message, code, details, status }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details ?? {}
    this.status = status
  }

  /** Messages for one form field, or an empty array. */
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

// Shared across every 401 that arrives while a refresh is already running.
let refreshPromise = null

/**
 * Exchange the refresh token for a new pair, at most once concurrently.
 * Returns the new access token, or null if the session is truly over.
 */
function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve(null)

  refreshPromise = axios
    // A bare axios call, not `api`: going through the instance would re-enter
    // these interceptors and, on a rejected refresh, recurse.
    .post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
    .then(({ data }) => {
      setTokens({ access: data.access, refresh: data.refresh })
      return data.access
    })
    .catch(() => {
      // The refresh token is expired, blacklisted or forged. Nothing to salvage.
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
      throw new ApiError({
        message: 'Could not reach the server. Check your connection.',
        code: 'network_error',
        status: 0,
      })
    }

    const isAuthEndpoint = config?.url?.includes('/auth/token/')

    // `_retried` stops an infinite loop when the refreshed token is also
    // rejected — one retry per request, then the error surfaces.
    if (response.status === 401 && !config._retried && !isAuthEndpoint) {
      config._retried = true

      const token = await refreshAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        return api(config)
      }
    }

    const envelope = response.data?.error
    throw new ApiError({
      message: envelope?.message ?? 'Something went wrong.',
      code: envelope?.code ?? 'error',
      details: envelope?.details,
      status: response.status,
    })
  },
)
