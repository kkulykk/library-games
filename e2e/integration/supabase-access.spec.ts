// Opt-in real-Supabase integration canary (TEST-02 / D-13, D-14).
//
// This is the ONLY test that crosses the real network boundary to a live
// Supabase project. It proves the two production-path security properties the
// in-memory fake cannot:
//
//   1. ACCESS-05 — a second subscriber receives the `{ state, version }`
//      broadcast on the public topic `room:CODE` (the `realtime.send(..., false)`
//      delivery path; the fake has no real Realtime, so only this catches a
//      `broadcast_changes()`/`private:true` misuse — Pitfall 1).
//   2. ACCESS-03 — a `dispatch_<game>` RPC called with a wrong/missing
//      `room_token` is rejected with Postgres errcode `42501`.
//
// Self-skips when SUPABASE_TEST_URL is unset (including CI), so it never adds
// CI cost or a standing project dependency. Run on demand:
//
//   SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... pnpm test:supabase
//
// Required env vars:
//   - SUPABASE_TEST_URL       real Supabase project URL
//   - SUPABASE_TEST_ANON_KEY  that project's anon key
//
// NOTE — Phase-3 deferral (D-14): the enumeration-prevention assertion (that a
// non-member cannot SELECT/enumerate rooms) is intentionally NOT asserted here.
// In this additive phase the table SELECT policy is still `using (true)`
// (permissive), so enumeration is still possible by design until Phase 3 seals
// SELECT. That assertion belongs to Phase 3 and is added there.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { generateRoomCode } from '../../src/lib/room-code'

const SUPABASE_TEST_URL = process.env.SUPABASE_TEST_URL
const SUPABASE_TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY

// Self-skip with no real backend configured (including in CI). Never red.
test.skip(!SUPABASE_TEST_URL, 'real Supabase env not set (SUPABASE_TEST_URL)')

// A minimal valid uno game state: the create RPC validates every name in
// `state.players` via is_valid_player_name, so a single valid player suffices.
function freshUnoState(playerId: string) {
  return {
    players: [{ id: playerId, name: 'Roman' }],
  }
}

test.describe('real Supabase access control (canary)', () => {
  test('a second subscriber receives the broadcast on room:CODE (ACCESS-05)', async () => {
    const url = SUPABASE_TEST_URL!
    const key = SUPABASE_TEST_ANON_KEY!

    const writer = createClient(url, key)
    const subscriber = createClient(url, key)

    const code = generateRoomCode()
    const playerId = `p_${Math.random().toString(36).slice(2, 10)}`

    // Subscribe a SECOND client to the public room topic BEFORE the write so we
    // do not race the broadcast. Subscribe WITHOUT `private: true` (public topic).
    const received = new Promise<{ state: unknown; version: number }>((resolve, reject) => {
      const channel = subscriber.channel(`room:${code}`)
      const timer = setTimeout(() => {
        subscriber.removeChannel(channel)
        reject(new Error('did not receive a broadcast on room:CODE within timeout'))
      }, 8000)
      channel
        .on('broadcast', { event: 'state' }, (msg) => {
          clearTimeout(timer)
          subscriber.removeChannel(channel)
          resolve(msg.payload as { state: unknown; version: number })
        })
        .subscribe()
    })

    // Give the subscription a moment to attach before the write triggers the broadcast.
    await new Promise((r) => setTimeout(r, 1000))

    const { data: created, error: createErr } = await writer.rpc('create_uno', {
      p_code: code,
      p_state: freshUnoState(playerId),
    })
    expect(createErr).toBeNull()
    const room = Array.isArray(created) ? created[0] : created
    expect(room?.room_token).toBeTruthy()

    // A dispatch (UPDATE) fires the AFTER UPDATE broadcast trigger.
    const nextState = {
      players: [
        { id: playerId, name: 'Roman' },
        { id: 'x', name: 'Two' },
      ],
    }
    const { error: dispatchErr } = await writer.rpc('dispatch_uno', {
      p_code: code,
      p_room_token: room.room_token,
      p_new_state: nextState,
      p_expected_version: room.version,
    })
    expect(dispatchErr).toBeNull()

    const payload = await received
    expect(payload).toBeTruthy()
    expect(typeof payload.version).toBe('number')
    expect(payload.state).toBeTruthy()

    await writer.removeAllChannels()
    await subscriber.removeAllChannels()
  })

  test('dispatch rejects a wrong/missing room_token (ACCESS-03)', async () => {
    const url = SUPABASE_TEST_URL!
    const key = SUPABASE_TEST_ANON_KEY!
    const client = createClient(url, key)

    const code = generateRoomCode()
    const playerId = `p_${Math.random().toString(36).slice(2, 10)}`

    const { data: created, error: createErr } = await client.rpc('create_uno', {
      p_code: code,
      p_state: freshUnoState(playerId),
    })
    expect(createErr).toBeNull()
    const room = Array.isArray(created) ? created[0] : created
    expect(room?.version).toBeDefined()

    // Dispatch with a random (wrong) room_token must be rejected by the token gate.
    const wrongToken = '00000000-0000-0000-0000-000000000000'
    const { error } = await client.rpc('dispatch_uno', {
      p_code: code,
      p_room_token: wrongToken,
      p_new_state: { players: [{ id: playerId, name: 'Roman' }] },
      p_expected_version: room.version,
    })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')

    await client.removeAllChannels()
  })
})
