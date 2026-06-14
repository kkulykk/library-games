import { z } from 'zod'

// Single source of truth for the room-code format. The generator, the Zod
// validator, and the Postgres `with check` regex are all derived from the
// constants below so the three layers cannot drift (CODE-03).

// 32 Crockford base-32 symbols: 0-9 then A-Z minus I, L, O, U.
export const ROOM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const ROOM_CODE_LENGTH = 6

// TS regex and the literal SQL string MUST describe the same set.
export const ROOM_CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{6}$/
export const ROOM_CODE_REGEX_SQL = '^[0-9A-HJKMNP-TV-Z]{6}$'

// Test-only seam (E2E): a FIFO queue of codes the next generateRoomCode() calls
// should return verbatim, so a Playwright test can force a deterministic collision
// (return an already-seeded code once, then real CSPRNG codes). Honored ONLY when
// the in-memory fake Supabase is active — it is inert in every real deployment.
const E2E_FAKE = process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1'

declare global {
  var __E2E_FORCED_ROOM_CODES__: string[] | undefined
}

// Generate a 6-char room code from a CSPRNG. The alphabet is exactly 32 = 2^5,
// so `byte & 31` is an unbiased index into it (no modulo bias). No Math.random.
export function generateRoomCode(): string {
  if (E2E_FAKE && typeof globalThis !== 'undefined') {
    const forced = globalThis.__E2E_FORCED_ROOM_CODES__
    if (forced && forced.length > 0) {
      const next = forced.shift()
      if (next) return next
    }
  }
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i] & 31]
  }
  return code
}

// Edge normalizer for user-typed codes: uppercase, fold Crockford look-alikes
// (O->0, I/L->1; U is already excluded from the alphabet), strip anything not in
// the alphabet, and cap at the code length. This lives OUTSIDE the validator so
// roomCodeSchema can stay strict (D-03).
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
}

// Strict validator — no `.transform()`. Its accept-set equals the DB regex's.
export const roomCodeSchema = z.string().regex(ROOM_CODE_REGEX)
