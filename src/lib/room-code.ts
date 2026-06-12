// Room codes must satisfy the RLS insert policy: ^[A-Z0-9]{4}$ (see supabase-schema.sql).
const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export const ROOM_CODE_LENGTH = 4

export function generateRoomCode(): string {
  // Rejection sampling: 256 % 36 !== 0, so bytes >= 252 would bias the modulo.
  const maxUnbiased = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length
  let code = ''
  const bytes = new Uint8Array(2 * ROOM_CODE_LENGTH)
  while (code.length < ROOM_CODE_LENGTH) {
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= maxUnbiased) continue
      code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
      if (code.length === ROOM_CODE_LENGTH) break
    }
  }
  return code
}
