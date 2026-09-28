import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'shim.roster-autosave'

/**
 * Whether names typed into a player box are saved to the roster on their own.
 *
 * On by default — that is what the saved roster is for — but a one-off guest
 * or a joke name should not have to be deleted from the roster afterwards.
 * Switched from the saved roster's header, where the effect is visible.
 *
 * A per-device preference rather than an account setting: it is about how
 * this person likes to type on this screen, and it has to work signed out.
 * Built on `useLocalStorage`, so every box on the page reads the same value
 * the moment it changes.
 */
export function useAutoSaveRoster() {
  return useLocalStorage(STORAGE_KEY, true)
}
