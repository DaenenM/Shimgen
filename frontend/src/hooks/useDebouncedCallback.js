import { useCallback, useEffect, useRef } from 'react'

/**
 * Run `fn` once things go quiet, rather than on every call.
 *
 * Used for work that only has to happen eventually — reconciling the bracket
 * against the server after a result, say. A host reports several matches in a
 * row, and firing a full refetch per click leaves the page visibly settling
 * long after the click that caused it.
 *
 * The latest `fn` is kept in a ref so the returned callback is stable: putting
 * it in the dependency list would make a new debouncer every render, which
 * debounces nothing.
 */
export function useDebouncedCallback(fn, delay = 300) {
  const latest = useRef(fn)
  const timer = useRef(null)

  useEffect(() => {
    latest.current = fn
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  return useCallback(
    (...args) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => latest.current(...args), delay)
    },
    [delay],
  )
}
