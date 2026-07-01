import { z } from 'zod'

// Single source of truth for the player-name rule (D-05/D-06). The client Zod
// validator below is the UX-side mirror of the Postgres `is_valid_player_name`
// function in supabase/schema.sql. The server is authoritative; this validator
// MUST be a SUBSET of the Postgres accept-set (INPUT-03 contract: client ⊆
// Postgres — the client may be stricter, never looser). Both layers agree on
// the 1..20 length bound (after trim) and on rejecting Unicode Cc/Cf/Zl/Zp.

export const PLAYER_NAME_MIN = 1
export const PLAYER_NAME_MAX = 20

// Locked accept/reject rule (D-05):
//   trim → require length 1..20 (counted in code points) → reject any character
//   in Unicode categories Cc (control), Cf (format / zero-width), Zl (line
//   separator) or Zp (paragraph separator). Everything else — unicode letters,
//   digits, punctuation, emoji — is allowed.
//
// `\p{Cc}|\p{Cf}|\p{Zl}|\p{Zp}` (with the `u` flag) is at least as strict as the
// Postgres predicate, which targets Cc plus a curated list of Cf/Zl/Zp code
// points; rejecting the whole categories keeps client ⊆ Postgres.
const FORBIDDEN_NAME_CHARS = /\p{Cc}|\p{Cf}|\p{Zl}|\p{Zp}/u

// Documents the equivalent Postgres predicate so the parity is reviewable. This
// is the INPUT-03 contract anchor (client ⊆ Postgres). Kept in sync with
// `public.is_valid_player_name` in supabase/schema.sql.
export const PLAYER_NAME_SQL_PREDICATE =
  "char_length(btrim(name)) between 1 and 20 and btrim(name) !~ '[[:cntrl:]]' and btrim(name) rejects Cf/Zl/Zp code points"

// Count length in Unicode code points (not UTF-16 units) so an emoji like 🎮
// counts as 1 — matching Postgres `char_length`, which counts multibyte/emoji
// as a single character. This keeps the 1..20 bound a true subset of Postgres.
function codePointLength(value: string): number {
  return [...value].length
}

// Strict validator — no `.transform()` that mutates downstream state. Trimming
// is for validation only (mirror room-code.ts keeping roomCodeSchema strict).
export const playerNameSchema = z.string().superRefine((raw, ctx) => {
  const trimmed = raw.trim()
  const len = codePointLength(trimmed)
  if (len < PLAYER_NAME_MIN || len > PLAYER_NAME_MAX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Name must be ${PLAYER_NAME_MIN}-${PLAYER_NAME_MAX} characters after trimming`,
    })
    return
  }
  if (FORBIDDEN_NAME_CHARS.test(trimmed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Name must not contain control, format, or separator characters',
    })
  }
})

// Optional helper for the UI when it wants to store the trimmed value. The
// schema itself validates the raw input; trimming for storage is a separate,
// explicit choice (mirrors normalizeRoomCode living outside roomCodeSchema).
export function trimmedPlayerName(raw: string): string {
  return raw.trim()
}

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
