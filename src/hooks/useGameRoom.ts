'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RoomRpcRow } from '@/lib/supabase'
import { generateRoomCode } from '@/lib/room-code'
import { randomId } from '@/lib/uuid'
import type { ZodType } from 'zod'

const SESSION_TTL_MS = 24 * 60 * 60 * 1000

// Runtime guard for presence rows crossing the (untrusted) presence channel into React.
// Strictly stronger than the previous unchecked player_id cast: a malformed presence row is
// now filtered out instead of blindly trusted (T-04-02).
function hasPlayerId(p: unknown): p is { player_id: string } {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as { player_id?: unknown }).player_id === 'string'
  )
}

interface Session {
  roomCode: string
  playerId: string
  playerName: string
  // Per-room write capability minted by create/join/restore (Phase 2, D-01..D-04).
  // Pre-Phase-2 sessions persisted without it; treated as '' on load and re-issued by restore.
  roomToken: string
  ts: number
}

function saveSession(key: string, session: Omit<Session, 'ts'>) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...session, ts: Date.now() }))
  } catch {}
}

function loadSession(key: string): Session | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data: Session = JSON.parse(raw)
    if (Date.now() - data.ts > SESSION_TTL_MS) return null
    // A legacy session minted before Phase 2 has no roomToken; never let that crash
    // a restore — default to '' and rely on restore_<game> to re-issue it (D-04).
    if (typeof data.roomToken !== 'string') data.roomToken = ''
    return data
  } catch {
    return null
  }
}

// Derive a Phase-2 RPC name from a room table: `<game>_rooms` + op -> `<op>_<game>`
// e.g. rpcName('uno_rooms', 'dispatch') === 'dispatch_uno'. (ACCESS-02)
function rpcName(
  tableName: string,
  op: 'create' | 'join' | 'restore' | 'dispatch' | 'get'
): string {
  return `${op}_${tableName.replace('_rooms', '')}`
}

// Map stable Postgres errcodes from the SECURITY DEFINER RPCs (plan 01) to the existing
// friendly UI strings. No raw DB `error.message` is ever surfaced to the player (INPUT-03,
// Pitfall 6). Returns null when the code is not a recognized RPC errcode so callers can fall
// back to their own context-specific message.
function mapRpcError(code: string | undefined): string | null {
  switch (code) {
    case '42501':
      return 'You are not a member of this room.'
    case '40001':
      return 'Action failed due to a conflict. Please try again.'
    case '22023':
      return 'Room data is invalid. Try again.'
    default:
      return null
  }
}

function clearSession(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

export type RoomStatus = 'idle' | 'restoring' | 'creating' | 'joining' | 'connected' | 'error'

// Base state shape that all game states must have
interface BaseGameState {
  phase: string
  players: { id: string }[]
}

export interface BroadcastConfig<TBroadcast> {
  channelPrefix: string
  schema: ZodType<TBroadcast>
}

export interface GameRoomConfig<TState extends BaseGameState, TAction, TBroadcast = never> {
  tableName: string
  channelPrefix: string
  sessionKey: string
  stateSchema: ZodType<TState>
  applyAction: (state: TState, action: TAction) => TState
  createLobbyState: (host: TState['players'][number]) => TState
  createPlayer: (info: {
    id: string
    name: string
    isHost: boolean
    playerIndex: number
    extras?: Record<string, unknown>
  }) => TState['players'][number]
  addPlayer: (state: TState, player: TState['players'][number]) => TState
  broadcast?: BroadcastConfig<TBroadcast>
  onBeforeLeave?: (ctx: {
    gameState: TState | null
    roomCode: string | null
    playerId: string | null
    roomToken: string
    tableName: string
    applyAction: (state: TState, action: TAction) => TState
    stateSchema: ZodType<TState>
  }) => Promise<void>
}

export interface UseGameRoomReturn<TState, TAction, TBroadcast = never> {
  gameState: TState | null
  playerId: string | null
  roomCode: string | null
  status: RoomStatus
  error: string | null
  savedSession: Session | null
  onlinePlayerIds: string[]
  // CLIENT-01: 'desynced' when a realtime payload fails Zod safeParse or the channel reports
  // CHANNEL_ERROR/TIMED_OUT/CLOSED; auto-clears to 'live' on the next valid apply or SUBSCRIBED.
  connectionStatus: 'live' | 'desynced'
  createRoom: (playerName: string, extras?: Record<string, unknown>) => Promise<void>
  joinRoom: (code: string, playerName: string, extras?: Record<string, unknown>) => Promise<void>
  restoreSession: () => Promise<void>
  dispatch: (action: TAction) => Promise<void>
  leaveRoom: () => Promise<void>
  broadcast: [TBroadcast] extends [never] ? null : (message: TBroadcast) => void
  onBroadcast: [TBroadcast] extends [never]
    ? null
    : React.MutableRefObject<((message: TBroadcast) => void) | null>
}

// Shared `onBeforeLeave` for games whose GameAction includes a
// `{ type: 'REMOVE_PLAYER'; playerId: string }` variant: strips the leaving player from
// state and writes it back through the token-gated dispatch RPC, retrying against the
// latest {state,version} on CAS conflict (up to 3x). A bad/missing token (42501) is
// terminal — no retry can fix it. No-ops if the room is already gone.
export function createLeaveByRemovingPlayer<
  TState extends BaseGameState,
  TAction extends { type: string },
>(): NonNullable<GameRoomConfig<TState, TAction>['onBeforeLeave']> {
  return async ({
    gameState,
    roomCode,
    playerId,
    roomToken,
    tableName,
    applyAction,
    stateSchema,
  }) => {
    if (!gameState || !roomCode || !playerId || !supabase) return

    const MAX_RETRIES = 3
    const getRpc = rpcName(tableName, 'get')
    const dispatchRpc = rpcName(tableName, 'dispatch')
    let currentState: TState | null = gameState

    const { data: initial } = await supabase.rpc(getRpc, { p_code: roomCode })
    const initialRow = initial && initial.length > 0 ? initial[0] : null
    if (!initialRow) return
    let currentVersion = initialRow.version as number

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (!currentState) break
      const newState = applyAction(currentState, {
        type: 'REMOVE_PLAYER',
        playerId,
      } as unknown as TAction)
      if (newState === currentState) break

      const { data, error: dispatchErr } = await supabase.rpc(dispatchRpc, {
        p_code: roomCode,
        p_room_token: roomToken,
        p_new_state: newState,
        p_expected_version: currentVersion,
      })

      if (data && data.length > 0) break
      if (dispatchErr?.code === '42501') break

      if (attempt < MAX_RETRIES) {
        const { data: fresh } = await supabase.rpc(getRpc, { p_code: roomCode })
        const freshRow = fresh && fresh.length > 0 ? fresh[0] : null
        if (!freshRow) break
        const parsedFresh = stateSchema.safeParse(freshRow.state)
        if (!parsedFresh.success) {
          console.error(`[${tableName}] Invalid GameState in leaveRoom retry:`, parsedFresh.error)
          break
        }
        currentState = parsedFresh.data
        currentVersion = freshRow.version as number
      }
    }
  }
}

export function useGameRoom<TState extends BaseGameState, TAction, TBroadcast = never>(
  config: GameRoomConfig<TState, TAction, TBroadcast>
): UseGameRoomReturn<TState, TAction, TBroadcast> {
  const [gameState, setGameState] = useState<TState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [status, setStatus] = useState<RoomStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [savedSession, setSavedSession] = useState<Session | null>(null)
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([])
  // CLIENT-01 (D-02/D-03): visible, self-healing realtime-trouble flag. Set 'desynced' at the
  // four trigger sites (invalid apply, invalid broadcast, state-channel error, presence error);
  // cleared back to 'live' only at the two recovery points (valid apply, SUBSCRIBED) — Pitfall 5.
  const [connectionStatus, setConnectionStatus] = useState<'live' | 'desynced'>('live')
  const stateChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const broadcastChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null
  )
  const presenceChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null
  )
  const onBroadcastRef = useRef<((message: TBroadcast) => void) | null>(null)
  const gameStateRef = useRef<TState | null>(null)
  const versionRef = useRef(0)
  // Per-room write capability for the dispatch RPC; set by create/join/restore (D-01..D-04).
  const roomTokenRef = useRef('')

  // Store config in ref to avoid dependency issues
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    setSavedSession(loadSession(configRef.current.sessionKey))
  }, [])

  // Create (or recreate) the presence channel and start tracking this player. Extracted from the
  // presence effect so the CLIENT-02 tab-close `visible` path can re-establish presence too:
  // teardown() nulls presenceChannelRef, and subscribeToRoom only recreates state+broadcast, so
  // without this the returning player would stay invisible to peers (Pitfall 4). Idempotent:
  // unsubscribes any existing presence channel first (null-checked) before opening a new one.
  const subscribeToPresence = useCallback((pid: string, code: string) => {
    if (!supabase) return
    const { channelPrefix } = configRef.current
    presenceChannelRef.current?.unsubscribe()
    const channel = supabase
      .channel(`${channelPrefix}-presence:${code}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const ids = Object.values(state)
          .flat()
          .filter(hasPlayerId)
          .map((p) => p.player_id)
          .filter(Boolean)
        setOnlinePlayerIds(ids)
      })
      .subscribe(async (s: string) => {
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          console.error(`[presence] channel ${s}`)
          setConnectionStatus('desynced')
          return
        }
        if (s === 'SUBSCRIBED') {
          // CR-02: do NOT clear connectionStatus here. Presence re-subscribing says nothing
          // about the STATE channel's health; clearing on presence SUBSCRIBED produces a
          // false-healthy signal (amber pill hidden) while the state channel is still dead.
          // Only the state channel's SUBSCRIBED / valid-apply paths may clear the desync flag.
          await channel.track({ player_id: pid })
        }
      })
    presenceChannelRef.current = channel
  }, [])

  // Track presence to show which players are online
  useEffect(() => {
    if (!playerId || !roomCode || !supabase) return
    subscribeToPresence(playerId, roomCode)
    return () => {
      presenceChannelRef.current?.unsubscribe()
      presenceChannelRef.current = null
      setOnlinePlayerIds([])
    }
  }, [playerId, roomCode, subscribeToPresence])

  const setStateAndRef = useCallback((state: TState | null, version?: number) => {
    gameStateRef.current = state
    if (version !== undefined) versionRef.current = version
    setGameState(state)
  }, [])

  const subscribeToRoom = useCallback(
    (code: string) => {
      if (!supabase) return
      const { channelPrefix, tableName, stateSchema, broadcast: broadcastCfg } = configRef.current

      // Apply an incoming {state, version} only when it is strictly newer than what we hold
      // (Pitfall 5: strictly `>` drops stale/replayed payloads). The state is re-validated via
      // the Zod schema because the broadcast topic is public and attacker-influencable (T-02-10).
      const applyIfNewer = (rawState: unknown, version: unknown) => {
        if (typeof version !== 'number' || version <= versionRef.current) return
        const parsed = stateSchema.safeParse(rawState)
        if (!parsed.success) {
          console.error(`[${channelPrefix}] Invalid GameState payload:`, parsed.error)
          // D-02: an invalid payload is a recoverable desync — surface it (not just console).
          setConnectionStatus('desynced')
          return
        }
        setStateAndRef(parsed.data, version)
        // D-03: a valid apply means we are back in sync — auto-clear (no manual reload).
        setConnectionStatus('live')
      }

      const supabaseClient = supabase

      // CR-03: the `room:CODE` topic is public, so any code-knowing client can forge a
      // `state` broadcast. Never trust the broadcast payload as authoritative state —
      // treat the broadcast purely as a change signal and re-read {state, version}
      // through the SELECT path, applying that under the version guard. A forged payload
      // then costs at most one extra read: it cannot poison peers' state, and a forged
      // huge version can't freeze the room because the forged version is never written
      // to versionRef (only the value returned by the authoritative SELECT is).
      const refetchAuthoritativeState = async () => {
        const { data } = await supabaseClient.rpc(rpcName(tableName, 'get'), { p_code: code })
        const row = data && data.length > 0 ? data[0] : null
        if (row) applyIfNewer(row.state, row.version)
      }

      // State sync is broadcast-signalled now (ACCESS-05, D-08): the postgres_changes UPDATE
      // arm is gone. Subscribe to the plan-01 trigger's public `room:CODE` topic, event
      // 'state', and use it only as a wakeup to refetch authoritative state.
      stateChannelRef.current?.unsubscribe()
      stateChannelRef.current = supabaseClient
        .channel(`room:${code}`)
        .on('broadcast', { event: 'state' }, () => {
          void refetchAuthoritativeState()
        })
        // Refetch-on-reconnect (D-10): on (re)subscribe, re-read the current {state, version}
        // through the still-permissive SELECT (additive window), recovering any signal
        // missed while disconnected. No postgres_changes backstop.
        .subscribe(async (s: string) => {
          // D-02: channel trouble is the other failure class. Compare against the literal status
          // strings (RESEARCH anti-pattern: do NOT import REALTIME_SUBSCRIBE_STATES across the seam).
          if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            console.error(`[${channelPrefix}] State channel ${s}`)
            setConnectionStatus('desynced')
            return
          }
          if (s !== 'SUBSCRIBED') return
          // D-03: (re)subscribe means we are reconnected — clear, then recover missed state.
          setConnectionStatus('live')
          await refetchAuthoritativeState()
        })

      if (broadcastCfg) {
        broadcastChannelRef.current?.unsubscribe()
        broadcastChannelRef.current = supabase
          .channel(`${broadcastCfg.channelPrefix}:${code}`)
          .on('broadcast', { event: 'game' }, (payload: { payload: unknown }) => {
            if (onBroadcastRef.current) {
              const parsed = broadcastCfg.schema.safeParse(payload.payload)
              if (!parsed.success) {
                console.error(`[${channelPrefix}] Invalid broadcast payload:`, parsed.error)
                // D-02: malformed broadcast is the same recoverable desync class as a bad state.
                setConnectionStatus('desynced')
                return
              }
              onBroadcastRef.current(parsed.data)
            }
          })
          .subscribe()
      }
    },
    [setStateAndRef]
  )

  const broadcastFn = useCallback((message: TBroadcast) => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'game',
      payload: message,
    })
  }, [])

  const createRoom = useCallback(
    async (playerName: string, extras?: Record<string, unknown>) => {
      if (!supabase) return
      const cfg = configRef.current
      setStatus('creating')
      setError(null)

      const id = randomId()
      const hostPlayer = cfg.createPlayer({
        id,
        name: playerName,
        isHost: true,
        playerIndex: 0,
        extras,
      })
      const initialState = cfg.createLobbyState(hostPlayer)

      // Mint a fresh code each attempt; the create_<game> RPC owns the insert and raises a
      // unique_violation (23505) when the chosen code already exists, so regenerate and retry —
      // bounded to 3 attempts, mirroring the dispatch() CAS retry idiom (MAX_RETRIES = 3). Any
      // other error (network/22023 invalid name) fails fast. (CODE-02, ACCESS-02)
      const MAX_CREATE_ATTEMPTS = 3
      let inserted: RoomRpcRow | null = null
      let landedCode = ''
      let lastErrCode: string | undefined

      for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
        const code = generateRoomCode()
        const { data, error: err } = await supabase.rpc(rpcName(cfg.tableName, 'create'), {
          p_code: code,
          p_state: initialState,
        })

        if (data && data.length > 0) {
          inserted = data[0]
          landedCode = code
          break
        }
        lastErrCode = err?.code
        // Only a unique-violation is worth retrying with a fresh code.
        if (err?.code !== '23505') break
      }

      if (!inserted) {
        setError(mapRpcError(lastErrCode) ?? 'Failed to create room. Try again.')
        setStatus('error')
        return
      }

      const roomToken = inserted.room_token ?? ''
      roomTokenRef.current = roomToken
      setPlayerId(id)
      setRoomCode(landedCode)
      setStateAndRef(initialState, inserted.version)
      setStatus('connected')
      saveSession(cfg.sessionKey, { roomCode: landedCode, playerId: id, playerName, roomToken })
      subscribeToRoom(landedCode)
    },
    [subscribeToRoom, setStateAndRef]
  )

  const joinRoom = useCallback(
    async (code: string, playerName: string, extras?: Record<string, unknown>) => {
      if (!supabase) return
      const cfg = configRef.current
      setStatus('joining')
      setError(null)

      const normalizedCode = code.trim().toUpperCase()
      const { data, error: err } = await supabase.rpc(rpcName(cfg.tableName, 'get'), {
        p_code: normalizedCode,
      })
      const row = data && data.length > 0 ? data[0] : null

      if (err || !row) {
        setError('Room not found. Check the code and try again.')
        setStatus('error')
        return
      }

      const parsedCurrent = cfg.stateSchema.safeParse(row.state)
      if (!parsedCurrent.success) {
        console.error(`[${cfg.channelPrefix}] Invalid GameState in joinRoom:`, parsedCurrent.error)
        setError('Room data is invalid. Try again.')
        setStatus('error')
        return
      }
      const currentState = parsedCurrent.data

      if (currentState.phase !== 'lobby') {
        setError('This game has already started.')
        setStatus('error')
        return
      }

      const id = randomId()
      const player = cfg.createPlayer({
        id,
        name: playerName,
        isHost: false,
        playerIndex: currentState.players.length,
        extras,
      })
      const newState = cfg.addPlayer(currentState, player)

      if (newState.players.length === currentState.players.length) {
        setError('Room is full.')
        setStatus('error')
        return
      }

      // The code-gated get_<game> read above computes newState/version, but the WRITE goes
      // through the join_<game> RPC, which CAS-updates and returns the room_token (D-02).
      // (ACCESS-02)
      const currentVersion = row.version
      const { data: updated, error: updateErr } = await supabase.rpc(
        rpcName(cfg.tableName, 'join'),
        {
          p_code: normalizedCode,
          p_new_state: newState,
          p_expected_version: currentVersion,
        }
      )

      if (updateErr || !updated || updated.length === 0) {
        // A 40001 here means another player won the join CAS race for this version.
        // Unlike dispatch (which can re-read and replay the same action), a join's
        // newState was computed against a now-stale roster, so the only safe recovery
        // is to surface the join-failure string and let the player re-join (which
        // recomputes the roster). 42501/22023 keep their member/validation strings;
        // any other error also falls back to the join-failure message. (ACCESS-03)
        const message =
          updateErr?.code === '40001'
            ? 'Failed to join room. Try again.'
            : (mapRpcError(updateErr?.code) ?? 'Failed to join room. Try again.')
        setError(message)
        setStatus('error')
        return
      }

      const roomToken = updated[0].room_token ?? ''
      roomTokenRef.current = roomToken
      setPlayerId(id)
      setRoomCode(normalizedCode)
      setStateAndRef(newState, updated[0].version ?? currentVersion + 1)
      setStatus('connected')
      saveSession(cfg.sessionKey, { roomCode: normalizedCode, playerId: id, playerName, roomToken })
      subscribeToRoom(normalizedCode)
    },
    [subscribeToRoom, setStateAndRef]
  )

  const restoreSession = useCallback(async () => {
    const cfg = configRef.current
    const session = loadSession(cfg.sessionKey)
    if (!session || !supabase) return
    setStatus('restoring')

    // restore_<game> verifies the player is a member (else 42501) and re-issues the room_token,
    // keeping pre-Phase-2 token-less sessions alive (D-04). (ACCESS-02/ACCESS-03)
    const { data, error: err } = await supabase.rpc(rpcName(cfg.tableName, 'restore'), {
      p_code: session.roomCode,
      p_player_id: session.playerId,
    })

    if (err || !data || data.length === 0) {
      clearSession(cfg.sessionKey)
      setSavedSession(null)
      setStatus('idle')
      return
    }

    const row = data[0]
    const parsedState = cfg.stateSchema.safeParse(row.state)
    if (!parsedState.success) {
      console.error(
        `[${cfg.channelPrefix}] Invalid GameState in restoreSession:`,
        parsedState.error
      )
      clearSession(cfg.sessionKey)
      setSavedSession(null)
      setStatus('idle')
      return
    }
    const state = parsedState.data

    const roomToken = row.room_token ?? ''
    roomTokenRef.current = roomToken
    saveSession(cfg.sessionKey, {
      roomCode: session.roomCode,
      playerId: session.playerId,
      playerName: session.playerName,
      roomToken,
    })
    setPlayerId(session.playerId)
    setRoomCode(session.roomCode)
    setStateAndRef(state, row.version)
    setStatus('connected')
    subscribeToRoom(session.roomCode)
  }, [subscribeToRoom, setStateAndRef])

  const dispatch = useCallback(
    async (action: TAction) => {
      if (!roomCode || !supabase) return
      const cfg = configRef.current

      const MAX_RETRIES = 3
      let currentState = gameStateRef.current
      let currentVersion = versionRef.current

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (!currentState) return
        const newState = cfg.applyAction(currentState, action)
        if (newState === currentState) return

        // Token-gated write through the dispatch_<game> RPC (ACCESS-02/ACCESS-03). The server
        // CAS-updates on p_expected_version and raises 42501 (bad/missing token), 40001 (conflict).
        const { data, error: dispatchErr } = await supabase.rpc(
          rpcName(cfg.tableName, 'dispatch'),
          {
            p_code: roomCode,
            p_room_token: roomTokenRef.current,
            p_new_state: newState,
            p_expected_version: currentVersion,
          }
        )

        if (data && data.length > 0) {
          // Apply the accepted state locally right away so controls feel instant
          // instead of waiting for the realtime broadcast echo from Supabase.
          setStateAndRef(newState, data[0].version ?? currentVersion + 1)
          return
        }

        // 42501 (not a member / bad token) is terminal — no retry can fix it.
        if (dispatchErr?.code === '42501') {
          setError('You are not a member of this room.')
          return
        }

        if (attempt < MAX_RETRIES) {
          const { data: fresh } = await supabase.rpc(rpcName(cfg.tableName, 'get'), {
            p_code: roomCode,
          })
          const freshRow = fresh && fresh.length > 0 ? fresh[0] : null
          if (!freshRow) return
          const parsedFresh = cfg.stateSchema.safeParse(freshRow.state)
          if (!parsedFresh.success) {
            console.error(
              `[${cfg.channelPrefix}] Invalid GameState in dispatch retry:`,
              parsedFresh.error
            )
            return
          }
          currentState = parsedFresh.data
          currentVersion = freshRow.version
          setStateAndRef(currentState, currentVersion)
        } else {
          setError('Action failed due to a conflict. Please try again.')
          // BL-02: MAX_RETRIES CAS conflicts exhausted means local {state, version} is
          // known-stale. Surface the desync indicator so the player knows they are out of sync.
          setConnectionStatus('desynced')
        }
      }
    },
    [roomCode, setStateAndRef]
  )

  const leaveRoom = useCallback(async () => {
    const cfg = configRef.current
    try {
      if (cfg.onBeforeLeave) {
        await cfg.onBeforeLeave({
          gameState: gameStateRef.current,
          roomCode,
          playerId,
          roomToken: roomTokenRef.current,
          tableName: cfg.tableName,
          applyAction: cfg.applyAction,
          stateSchema: cfg.stateSchema,
        })
      }
    } finally {
      stateChannelRef.current?.unsubscribe()
      stateChannelRef.current = null
      broadcastChannelRef.current?.unsubscribe()
      broadcastChannelRef.current = null
      presenceChannelRef.current?.unsubscribe()
      presenceChannelRef.current = null
      roomTokenRef.current = ''
      setStateAndRef(null, 0)
      setPlayerId(null)
      setRoomCode(null)
      setStatus('idle')
      setError(null)
      setOnlinePlayerIds([])
      clearSession(cfg.sessionKey)
      setSavedSession(null)
    }
  }, [roomCode, playerId, setStateAndRef])

  // CLIENT-02 (D-05..D-08): tear down realtime/broadcast/presence channels on tab close/hide
  // (`pagehide` / `visibilitychange→hidden`), NOT only on React unmount, and re-subscribe on
  // return (`→visible`). This is a GENTLE, channel-only teardown: it deliberately PRESERVES the
  // 24h localStorage session, status, playerId, gameState and onlinePlayerIds — a full leaveRoom
  // would be hostile because `hidden` fires on every routine mobile backgrounding (Pitfall 1).
  useEffect(() => {
    if (!roomCode || !playerId) return

    // Channel-only teardown (D-05). Null the refs after `?.unsubscribe()` so a second call —
    // both events firing, or an event followed by the unmount cleanup below — is a no-op (D-08).
    // MUST NOT clearSession / setStatus / setPlayerId / setGameState / setOnlinePlayerIds.
    const teardown = () => {
      stateChannelRef.current?.unsubscribe()
      stateChannelRef.current = null
      broadcastChannelRef.current?.unsubscribe()
      broadcastChannelRef.current = null
      presenceChannelRef.current?.unsubscribe()
      presenceChannelRef.current = null
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        teardown()
      } else if (document.visibilityState === 'visible') {
        // D-07: re-establish state+broadcast (subscribeToRoom re-reads authoritative {state,version}
        // on SUBSCRIBED — Phase 2 D-10) AND presence (Pitfall 4 — presence is a separate channel
        // that subscribeToRoom does not recreate).
        subscribeToRoom(roomCode)
        subscribeToPresence(playerId, roomCode)
      }
    }

    document.addEventListener('pagehide', teardown)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('pagehide', teardown)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [roomCode, playerId, subscribeToRoom, subscribeToPresence])

  useEffect(() => {
    return () => {
      stateChannelRef.current?.unsubscribe()
      broadcastChannelRef.current?.unsubscribe()
      presenceChannelRef.current?.unsubscribe()
    }
  }, [])

  return {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    savedSession,
    onlinePlayerIds,
    connectionStatus,
    createRoom,
    joinRoom,
    restoreSession,
    dispatch,
    leaveRoom,
    broadcast: (config.broadcast ? broadcastFn : null) as UseGameRoomReturn<
      TState,
      TAction,
      TBroadcast
    >['broadcast'],
    onBroadcast: (config.broadcast ? onBroadcastRef : null) as UseGameRoomReturn<
      TState,
      TAction,
      TBroadcast
    >['onBroadcast'],
  }
}
