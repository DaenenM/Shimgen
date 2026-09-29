// Whether names typed into a roster box get auto-saved to the roster.
// Used by RosterPicker, SavedRoster and TeamBuilder (via the saved-roster
// toggle) so every box on the page shares one setting.
// Defaults on; per-device, works signed out.

import { useLocalStorage } from '@/hooks/useLocalStorage'

const STORAGE_KEY = 'shim.roster-autosave'

export function useAutoSaveRoster() {
  return useLocalStorage(STORAGE_KEY, true)
}
