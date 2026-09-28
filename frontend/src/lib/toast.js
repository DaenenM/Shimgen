/**
 * A tiny toast store, callable from outside React.
 *
 * The main caller is the query client's global error handler, which runs
 * outside any component — so this is a module-level store read through
 * `useSyncExternalStore` rather than context.
 */

const DISMISS_AFTER = 6_000

let toasts = []
let nextId = 1
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function push(kind, message) {
  // One failure often arrives several times at once — a board edit and its
  // reconcile both hitting the same dead connection. Repeating the same line
  // three times reads as three problems.
  if (toasts.some((t) => t.message === message)) return

  const id = nextId++
  toasts = [...toasts, { id, kind, message }]
  emit()
  setTimeout(() => dismissToast(id), DISMISS_AFTER)
}

export const toast = {
  error: (message) => push('error', message),
}

export function subscribeToasts(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToasts() {
  return toasts
}
