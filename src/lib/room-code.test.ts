import fs from 'fs'
import path from 'path'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_REGEX,
  ROOM_CODE_REGEX_SQL,
  generateRoomCode,
  normalizeRoomCode,
  roomCodeSchema,
} from './room-code'

describe('alphabet sanity', () => {
  it('has exactly 32 symbols', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32)
  })

  it('has all-unique characters', () => {
    expect(new Set(ROOM_CODE_ALPHABET.split('')).size).toBe(32)
  })

  it('every single alphabet char matches ROOM_CODE_REGEX when repeated to length', () => {
    for (const ch of ROOM_CODE_ALPHABET) {
      expect(ROOM_CODE_REGEX.test(ch.repeat(ROOM_CODE_LENGTH))).toBe(true)
    }
  })

  it('excludes the Crockford look-alike letters I, L, O, U', () => {
    for (const ch of ['I', 'L', 'O', 'U']) {
      expect(ROOM_CODE_ALPHABET.includes(ch)).toBe(false)
    }
  })
})

describe('3-layer agreement', () => {
  const sqlRegex = new RegExp(ROOM_CODE_REGEX_SQL)

  it('every generated code passes the TS regex, the Zod schema, and the SQL regex', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect(ROOM_CODE_REGEX.test(code)).toBe(true)
      expect(roomCodeSchema.safeParse(code).success).toBe(true)
      expect(sqlRegex.test(code)).toBe(true)
      for (const ch of code) seen.add(ch)
    }
    // Over 2000 codes (12000 chars) every one of the 32 symbols should appear.
    expect(seen.size).toBe(32)
  })

  it('rejects the old 4-char hex format', () => {
    expect(roomCodeSchema.safeParse('A1B2').success).toBe(false)
    expect(ROOM_CODE_REGEX.test('A1B2')).toBe(false)
    expect(sqlRegex.test('A1B2')).toBe(false)
  })

  it('rejects codes containing excluded look-alike letters', () => {
    expect(roomCodeSchema.safeParse('IL0OU1').success).toBe(false)
  })
})

// Post-Phase-3 seal: the permissive insert-CHECK policies (which carried the
// room-code regex as `code ~ '<regex>'`) were dropped; INSERT is now RPC-only.
// SQL-side room-code validation therefore lives entirely in the SECURITY DEFINER
// RPC bodies as `p_code !~ '<regex>'` — one per RPC across 7 games × 5 RPC
// families (create/join/restore/dispatch/get) = 35. This guard keeps those 35
// literals from drifting off ROOM_CODE_REGEX_SQL (CODE-03).
describe('SQL drift guard', () => {
  const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  const literals = [...sql.matchAll(/p_code !~ '([^']+)'/g)].map((m) => m[1])

  it('finds exactly 35 RPC code-validation regex literals (7 games × 5 RPC families)', () => {
    expect(literals).toHaveLength(35)
  })

  it('has no permissive insert-CHECK code literals left after the seal', () => {
    expect([...sql.matchAll(/code ~ '([^']+)'/g)]).toHaveLength(0)
  })

  it('every SQL code regex literal is byte-identical to ROOM_CODE_REGEX_SQL', () => {
    for (const literal of literals) {
      expect(literal).toBe(ROOM_CODE_REGEX_SQL)
    }
  })
})

// MIGR-03: the access-control / broadcast DB layer is templated identically
// across all 7 room tables. Each templated element must appear exactly 7×; a
// future edit that templates only 6 of 7 (or drops one) trips these guards.
// ACCESS-04: every SECURITY DEFINER body must pin search_path to '' (lint 0011).
describe('schema templating drift guard (MIGR-03 / ACCESS-04)', () => {
  const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  const countMatches = (re: RegExp) => [...sql.matchAll(re)].length

  it('declares the room_token column on all 7 tables', () => {
    expect(countMatches(/room_token uuid not null default gen_random_uuid\(\)/g)).toBe(7)
  })

  it('wires the _broadcast_state after-update trigger on all 7 tables', () => {
    expect(countMatches(/_broadcast_state after update on public\./g)).toBe(7)
  })

  it.each(['create', 'join', 'restore', 'dispatch', 'get'])(
    'defines the %s_<game> RPC 7×',
    (op) => {
      expect(countMatches(new RegExp(`create or replace function public\\.${op}_`, 'g'))).toBe(7)
    }
  )

  it('pins search_path on every `security definer` function (definer hygiene, lint 0011)', () => {
    // Every SECURITY DEFINER function MUST pin search_path to '' (Advisor 0011). Some
    // non-definer functions (e.g. protect_immutable_columns) also pin it, so pinned ≥ definer
    // rather than strict equality — the invariant is that no definer body is left unpinned.
    const definer = countMatches(/security definer/g)
    const pinned = countMatches(/set search_path = ''/g)
    expect(definer).toBeGreaterThan(0)
    expect(pinned).toBeGreaterThanOrEqual(definer)
  })

  it('validates player names server-side on create + join + dispatch (21× — CR-04/INPUT-01)', () => {
    // Each of create/join/dispatch loops over players and calls is_valid_player_name,
    // templated across all 7 tables → 21 call sites. dispatch (the steady-state write
    // path) is a trust boundary and must validate too, not only create/join.
    expect(countMatches(/if not public\.is_valid_player_name\(v_player ->> 'name'\) then/g)).toBe(
      21
    )
  })

  it('enforces the lobby + add-one-player join invariant on all 7 tables (CR-02)', () => {
    // join_<game> must read the existing row and reject any write that is not a
    // single-player addition during lobby, so join cannot overwrite live state.
    expect(countMatches(/join is only valid in lobby/g)).toBe(7)
    expect(
      countMatches(
        /jsonb_array_length\(p_new_state -> 'players'\) <> jsonb_array_length\(v_row\.state -> 'players'\) \+ 1/g
      )
    ).toBe(7)
  })
})

describe('normalizeRoomCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeRoomCode('abc234')).toBe('ABC234')
  })

  it('maps O to 0 and I/L to 1', () => {
    expect(normalizeRoomCode('oil')).toBe('011')
  })

  it('strips non-alphabet characters', () => {
    expect(normalizeRoomCode('a1b-2 c3')).toBe('A1B2C3')
  })

  it('caps output at ROOM_CODE_LENGTH', () => {
    expect(normalizeRoomCode('ABCDEFGHJK')).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('produces a code that validates when given a clean 6-char look-alike input', () => {
    const normalized = normalizeRoomCode('o1l-abc def'.toUpperCase())
    expect(ROOM_CODE_REGEX.test(normalized)).toBe(normalized.length === ROOM_CODE_LENGTH)
  })
})
