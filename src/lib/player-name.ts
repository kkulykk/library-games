const STORAGE_KEY = 'library-games:player-name'

export function getSavedPlayerName(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function savePlayerName(name: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // Storage full or unavailable — silently ignore
  }
}
