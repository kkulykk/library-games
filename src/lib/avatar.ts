// Shared avatar selection persistence for multiplayer entry screens.
const AVATAR_STORAGE_KEY = 'library-games:avatar'

export function getSavedAvatar(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = Number(localStorage.getItem(AVATAR_STORAGE_KEY) ?? '0')
    if (Number.isInteger(raw) && raw >= 0 && raw <= 7) return raw
  } catch {
    /* ignore */
  }
  return 0
}

export function saveAvatar(index: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, String(index))
  } catch {
    /* ignore */
  }
}
