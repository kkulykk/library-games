/**
 * Wave 0 scaffold: the first unit test for the shared useGameRoom engine.
 *
 * Focus is CLIENT-01 / D-02 / D-03: the connectionStatus set-then-clear wiring at the
 * realtime trigger sites. The in-memory fake-supabase double only ever emits 'SUBSCRIBED'
 * (Pitfall 6), so the CHANNEL_ERROR/TIMED_OUT/CLOSED branch is unreachable via E2E and MUST
 * be driven here by a hand-rolled channel mock whose `.subscribe` status callback and
 * `broadcast` handlers the test can invoke with arbitrary inputs.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { createLeaveByRemovingPlayer, useGameRoom, type GameRoomConfig } from './useGameRoom'

// --- Controllable supabase channel double ----------------------------------------------------

type StatusCb = (status: string) => void | Promise<void>
type BroadcastCb = (payload: { payload: unknown }) => void

interface ChannelDouble {
  name: string
  statusCb: StatusCb | null
  broadcastHandlers: Record<string, BroadcastCb>
  on: jest.Mock
  subscribe: jest.Mock
  send: jest.Mock
  track: jest.Mock
  presenceState: jest.Mock
  unsubscribe: jest.Mock
}

const channels: ChannelDouble[] = []

function makeChannel(name: string): ChannelDouble {
  const ch: ChannelDouble = {
    name,
    statusCb: null,
    broadcastHandlers: {},
    on: jest.fn(),
    subscribe: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined),
    track: jest.fn().mockResolvedValue(undefined),
    presenceState: jest.fn().mockReturnValue({}),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  }
  ch.on.mockImplementation((type: string, config: { event?: string }, cb: BroadcastCb) => {
    if (type === 'broadcast' && config?.event) ch.broadcastHandlers[config.event] = cb
    return ch
  })
  ch.subscribe.mockImplementation((cb?: StatusCb) => {
    if (cb) ch.statusCb = cb
    return ch
  })
  return ch
}

// Authoritative {state, version} the get_<game> RPC returns to refetchAuthoritativeState.
let authoritativeRow: { state: unknown; version: number } | null = null

const rpc = jest.fn(
  async (
    fn: string,
    _payload?: unknown
  ): Promise<{ data: unknown; error: { code?: string } | null }> => {
    if (fn.startsWith('create_')) {
      return {
        data: [{ state: { phase: 'lobby', players: [] }, version: 1, room_token: 'tok' }],
        error: null,
      }
    }
    if (fn.startsWith('get_')) {
      return { data: authoritativeRow ? [authoritativeRow] : [], error: null }
    }
    return { data: null, error: null }
  }
)

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      const ch = makeChannel(name)
      channels.push(ch)
      return ch
    },
    rpc: (...args: unknown[]) => rpc(...(args as [string, unknown?])),
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}))

// --- Minimal game config ---------------------------------------------------------------------

const StateSchema = z.object({
  phase: z.string(),
  players: z.array(z.object({ id: z.string() })),
})
type State = z.infer<typeof StateSchema>
type Action = { type: 'noop' }

const config: GameRoomConfig<State, Action> = {
  tableName: 'test_rooms',
  channelPrefix: 'test',
  sessionKey: 'test_session',
  stateSchema: StateSchema,
  applyAction: (s) => s,
  createLobbyState: (host) => ({ phase: 'lobby', players: [host] }),
  createPlayer: ({ id }) => ({ id }),
  addPlayer: (s, p) => ({ ...s, players: [...s.players, p] }),
}

function stateChannel() {
  return channels.find((c) => c.name.startsWith('room:'))
}
function presenceChannel() {
  return channels.find((c) => c.name.includes('-presence:'))
}

beforeEach(() => {
  channels.length = 0
  authoritativeRow = null
  rpc.mockClear()
  localStorage.clear()
})

describe('useGameRoom connectionStatus (CLIENT-01)', () => {
  async function connect() {
    const hook = renderHook(() => useGameRoom<State, Action>(config))
    await act(async () => {
      await hook.result.current.createRoom('Alice')
    })
    return hook
  }

  it('starts live and stays live on a clean subscribe', async () => {
    const hook = await connect()
    expect(hook.result.current.connectionStatus).toBe('live')

    const ch = stateChannel()!
    await act(async () => {
      await ch.statusCb!('SUBSCRIBED')
    })
    expect(hook.result.current.connectionStatus).toBe('live')
  })

  it('flips to desynced on an invalid {state} payload, then auto-clears on a valid apply (D-02/D-03, Pitfall 5)', async () => {
    const hook = await connect()
    const ch = stateChannel()!

    // A 'state' broadcast wakes a refetch; the authoritative row is garbage → safeParse fails.
    authoritativeRow = { state: { phase: 123, players: 'nope' }, version: 99 }
    await act(async () => {
      ch.broadcastHandlers['state']({ payload: {} })
    })
    await waitFor(() => expect(hook.result.current.connectionStatus).toBe('desynced'))

    // Next refetch returns a valid, strictly-newer row → applies and auto-clears to live.
    authoritativeRow = { state: { phase: 'play', players: [{ id: 'a' }] }, version: 100 }
    await act(async () => {
      ch.broadcastHandlers['state']({ payload: {} })
    })
    await waitFor(() => expect(hook.result.current.connectionStatus).toBe('live'))
  })

  it('flips to desynced on a CHANNEL_ERROR status (the fake-only-SUBSCRIBED branch, Pitfall 6)', async () => {
    const hook = await connect()
    const ch = stateChannel()!

    await act(async () => {
      await ch.statusCb!('CHANNEL_ERROR')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')
  })

  it('flips to desynced on TIMED_OUT and CLOSED statuses', async () => {
    const hook = await connect()
    const ch = stateChannel()!

    await act(async () => {
      await ch.statusCb!('TIMED_OUT')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')

    await act(async () => {
      await ch.statusCb!('CLOSED')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')
  })

  it('clears back to live on a re-SUBSCRIBED after channel trouble (D-03 auto-recovery)', async () => {
    const hook = await connect()
    const ch = stateChannel()!

    await act(async () => {
      await ch.statusCb!('CHANNEL_ERROR')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')

    await act(async () => {
      await ch.statusCb!('SUBSCRIBED')
    })
    expect(hook.result.current.connectionStatus).toBe('live')
  })

  it('flips to desynced when the presence channel reports an error status', async () => {
    const hook = await connect()
    const presence = presenceChannel()!

    await act(async () => {
      await presence.statusCb!('CHANNEL_ERROR')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')
  })

  it('does NOT clear a state-channel desync when only the presence channel re-subscribes (CR-02)', async () => {
    const hook = await connect()
    const stateCh = stateChannel()!
    const presence = presenceChannel()!

    // State channel goes dead → desynced.
    await act(async () => {
      await stateCh.statusCb!('CHANNEL_ERROR')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')

    // Presence independently recovers. This must NOT mask the dead state channel: the desync
    // flag may only be cleared by the state channel's own SUBSCRIBED / valid-apply paths.
    await act(async () => {
      await presence.statusCb!('SUBSCRIBED')
    })
    expect(hook.result.current.connectionStatus).toBe('desynced')
    // Presence still tracks the player so peers see them online (unchanged behavior).
    expect(presence.track).toHaveBeenCalledWith({ player_id: expect.any(String) })
  })

  it('keeps connectionStatus on the public return contract', async () => {
    const hook = await connect()
    expect(hook.result.current).toHaveProperty('connectionStatus')
    // Existing public fields remain intact (additive-only contract change).
    for (const field of [
      'gameState',
      'playerId',
      'roomCode',
      'status',
      'error',
      'onlinePlayerIds',
    ]) {
      expect(hook.result.current).toHaveProperty(field)
    }
  })
})

describe('useGameRoom dispatch CAS exhaustion (BL-02)', () => {
  // A config whose applyAction always returns a NEW state object, so dispatch does not early-return
  // on the `newState === currentState` reference check and actually enters the CAS retry loop.
  const casConfig: GameRoomConfig<State, Action> = {
    ...config,
    applyAction: (s) => ({ ...s, players: [...s.players] }),
  }

  async function connect() {
    const hook = renderHook(() => useGameRoom<State, Action>(casConfig))
    await act(async () => {
      await hook.result.current.createRoom('Alice')
    })
    return hook
  }

  it('sets connectionStatus to desynced after MAX_RETRIES CAS conflicts are exhausted', async () => {
    const hook = await connect()
    expect(hook.result.current.connectionStatus).toBe('live')

    // dispatch_<game> RPC returns { data: null } for every attempt (default mock) → CAS conflict.
    // get_<game> returns a valid, strictly-newer row so each retry refetches and loops again
    // (rather than bailing on a missing/invalid fresh row) until MAX_RETRIES is exhausted.
    authoritativeRow = { state: { phase: 'play', players: [{ id: 'a' }] }, version: 999 }

    await act(async () => {
      await hook.result.current.dispatch({ type: 'noop' })
    })

    // Exhausted: both the existing error AND the new desync flag are surfaced.
    expect(hook.result.current.error).toBe('Action failed due to a conflict. Please try again.')
    expect(hook.result.current.connectionStatus).toBe('desynced')
  })

  it('treats a 22023 dispatch rejection as terminal — no retry, invalid-data error (P2-6)', async () => {
    const hook = await connect()
    rpc.mockClear()

    // The server rejects the payload itself (invalid name / oversized state / too
    // many players). Replaying cannot fix it, so dispatch must bail without a refetch.
    rpc.mockImplementationOnce(async () => ({ data: null, error: { code: '22023' } })) // dispatch_test

    await act(async () => {
      await hook.result.current.dispatch({ type: 'noop' })
    })

    expect(hook.result.current.error).toBe('Room data is invalid. Try again.')
    // Only the single dispatch call — no get_ refetch, no retry loop.
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(hook.result.current.connectionStatus).not.toBe('desynced')
  })
})

describe('useGameRoom tab-close teardown lifecycle (CLIENT-02)', () => {
  // Override document.visibilityState (read-only in jsdom) for the hidden/visible paths.
  function setVisibility(state: 'hidden' | 'visible') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    })
  }

  async function connect() {
    const hook = renderHook(() => useGameRoom<State, Action>(config))
    await act(async () => {
      await hook.result.current.createRoom('Alice')
    })
    return hook
  }

  afterEach(() => {
    // Reset to the jsdom default so cases don't leak visibility state into one another.
    setVisibility('visible')
  })

  // P2-1: `pagehide` fires on `window`, not `document`, so the hook listens on window.
  it('unsubscribes the channels on pagehide WITHOUT clearing the session/status/playerId (D-05)', async () => {
    const hook = await connect()
    const stateCh = stateChannel()!
    const presenceCh = presenceChannel()!
    const playerIdBefore = hook.result.current.playerId
    const sessionRaw = localStorage.getItem('test_session')
    expect(sessionRaw).not.toBeNull()

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
    })

    // Channels torn down...
    expect(stateCh.unsubscribe).toHaveBeenCalled()
    expect(presenceCh.unsubscribe).toHaveBeenCalled()
    // ...but the session-bearing state is deliberately preserved (NOT a leaveRoom — D-05).
    expect(hook.result.current.status).toBe('connected')
    expect(hook.result.current.roomCode).not.toBeNull()
    expect(hook.result.current.playerId).toBe(playerIdBefore)
    expect(localStorage.getItem('test_session')).toBe(sessionRaw)
  })

  it('tears down on visibilitychange→hidden the same way (channel-only, session kept)', async () => {
    const hook = await connect()
    const stateCh = stateChannel()!
    const presenceCh = presenceChannel()!

    setVisibility('hidden')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(stateCh.unsubscribe).toHaveBeenCalled()
    expect(presenceCh.unsubscribe).toHaveBeenCalled()
    expect(hook.result.current.status).toBe('connected')
    expect(localStorage.getItem('test_session')).not.toBeNull()
  })

  it('is idempotent when both pagehide and visibilitychange→hidden fire — no throw, no double-unsubscribe on a nulled ref (D-08)', async () => {
    await connect()
    const stateCh = stateChannel()!

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(stateCh.unsubscribe).toHaveBeenCalledTimes(1)

    // Second teardown (visibilitychange→hidden after pagehide already nulled the refs) must be a
    // no-op: the ref is null so unsubscribe is NOT called again, and nothing throws.
    setVisibility('hidden')
    await act(async () => {
      expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow()
    })
    expect(stateCh.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes state + presence on visibilitychange→visible while still connected (D-07, Pitfall 4)', async () => {
    await connect()

    // Background: tear the channels down.
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
    })
    const channelsAfterTeardown = channels.length

    // Return: a valid authoritative row so refetch-on-reconnect applies cleanly.
    authoritativeRow = { state: { phase: 'play', players: [{ id: 'a' }] }, version: 50 }
    setVisibility('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // New state + presence channels were created (subscribeToRoom + subscribeToPresence).
    expect(channels.length).toBeGreaterThan(channelsAfterTeardown)
    const newStateChannels = channels.filter((c) => c.name.startsWith('room:'))
    const newPresenceChannels = channels.filter((c) => c.name.includes('-presence:'))
    expect(newStateChannels.length).toBeGreaterThanOrEqual(2)
    expect(newPresenceChannels.length).toBeGreaterThanOrEqual(2)

    // Presence re-establishes: the freshest presence channel drives a track() on SUBSCRIBED,
    // so the returning player becomes visible to peers again (Pitfall 4).
    const freshPresence = newPresenceChannels[newPresenceChannels.length - 1]
    await act(async () => {
      await freshPresence.statusCb!('SUBSCRIBED')
    })
    expect(freshPresence.track).toHaveBeenCalledWith({ player_id: expect.any(String) })
  })

  it('removes the lifecycle listeners on unmount (no leak across rooms)', async () => {
    // pagehide is a window event; visibilitychange is a document event (P2-1).
    const removeWindowSpy = jest.spyOn(window, 'removeEventListener')
    const removeDocumentSpy = jest.spyOn(document, 'removeEventListener')
    const hook = await connect()

    hook.unmount()

    expect(removeWindowSpy).toHaveBeenCalledWith('pagehide', expect.any(Function))
    expect(removeDocumentSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    removeWindowSpy.mockRestore()
    removeDocumentSpy.mockRestore()
  })
})

// Shared onBeforeLeave used by games that remove the leaving player from state instead of
// just disconnecting (CAH, Mindmeld). Exercised directly here rather than via renderHook
// since it's a standalone async function once returned from the factory.
describe('createLeaveByRemovingPlayer', () => {
  type RemoveAction = { type: 'noop' } | { type: 'REMOVE_PLAYER'; playerId: string }

  const applyAction = (s: State, action: RemoveAction): State =>
    action.type === 'REMOVE_PLAYER'
      ? { ...s, players: s.players.filter((p) => p.id !== action.playerId) }
      : s

  const baseCtx = {
    gameState: { phase: 'lobby', players: [{ id: 'host' }, { id: 'leaver' }] } as State,
    roomCode: 'ABCD',
    playerId: 'leaver',
    roomToken: 'tok',
    tableName: 'test_rooms',
    applyAction,
    stateSchema: StateSchema,
  }

  beforeEach(() => {
    rpc.mockClear()
  })

  it('does nothing when there is no active room to leave', async () => {
    const leave = createLeaveByRemovingPlayer<State, RemoveAction>()
    await leave({ ...baseCtx, gameState: null })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('no-ops when the room is already gone', async () => {
    const leave = createLeaveByRemovingPlayer<State, RemoveAction>()
    rpc.mockImplementationOnce(async () => ({ data: [], error: null })) // get_test: no rows

    await leave(baseCtx)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('get_test')
  })

  it('removes the player and dispatches on the first attempt', async () => {
    const leave = createLeaveByRemovingPlayer<State, RemoveAction>()
    rpc
      .mockImplementationOnce(async () => ({
        data: [{ state: baseCtx.gameState, version: 5 }],
        error: null,
      })) // get_test
      .mockImplementationOnce(async () => ({ data: [{ version: 6 }], error: null })) // dispatch_test

    await leave(baseCtx)

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[1][0]).toBe('dispatch_test')
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_code: 'ABCD',
      p_room_token: 'tok',
      p_expected_version: 5,
      p_new_state: { players: [{ id: 'host' }] },
    })
  })

  it('retries against the latest version on CAS conflict', async () => {
    const leave = createLeaveByRemovingPlayer<State, RemoveAction>()
    rpc
      .mockImplementationOnce(async () => ({
        data: [{ state: baseCtx.gameState, version: 5 }],
        error: null,
      })) // get_test (initial)
      .mockImplementationOnce(async () => ({ data: null, error: null })) // dispatch_test: conflict
      .mockImplementationOnce(async () => ({
        data: [{ state: baseCtx.gameState, version: 7 }],
        error: null,
      })) // get_test (refetch)
      .mockImplementationOnce(async () => ({ data: [{ version: 8 }], error: null })) // dispatch_test: retry succeeds

    await leave(baseCtx)

    expect(rpc).toHaveBeenCalledTimes(4)
    expect(rpc.mock.calls[3][1]).toMatchObject({ p_expected_version: 7 })
  })

  it('stops retrying on a terminal bad-token error (42501)', async () => {
    const leave = createLeaveByRemovingPlayer<State, RemoveAction>()
    rpc
      .mockImplementationOnce(async () => ({
        data: [{ state: baseCtx.gameState, version: 5 }],
        error: null,
      })) // get_test
      .mockImplementationOnce(async () => ({ data: null, error: { code: '42501' } })) // dispatch_test: bad token

    await leave(baseCtx)

    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
