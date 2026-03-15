'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ZodType } from 'zod'

const SESSION_TTL_MS = 24 * 60 * 60 * 1000

interface Session {
  roomCode: string
  playerId: string
  playerName: string
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
    return data
  } catch {
    return null
  }
}

function clearSession(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
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
  createLobbyState: (host: { id: string; name: string; isHost: true }) => TState
  createPlayer: (info: {
    id: string
    name: string
    isHost: boolean
    playerIndex: number
  }) => TState['players'][number]
  addPlayer: (state: TState, player: TState['players'][number]) => TState
  broadcast?: BroadcastConfig<TBroadcast>
  onBeforeLeave?: (ctx: {
    gameState: TState | null
    roomCode: string | null
    playerId: string | null
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
  createRoom: (playerName: string) => Promise<void>
  joinRoom: (code: string, playerName: string) => Promise<void>
  restoreSession: () => Promise<void>
  dispatch: (action: TAction) => Promise<void>
  leaveRoom: () => Promise<void>
  broadcast: [TBroadcast] extends [never] ? null : (message: TBroadcast) => void
  onBroadcast: [TBroadcast] extends [never]
    ? null
    : React.MutableRefObject<((message: TBroadcast) => void) | null>
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
  const dbChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const broadcastChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null
  )
  const onBroadcastRef = useRef<((message: TBroadcast) => void) | null>(null)
  const gameStateRef = useRef<TState | null>(null)
  const versionRef = useRef(0)

  // Store config in ref to avoid dependency issues
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    setSavedSession(loadSession(configRef.current.sessionKey))
  }, [])

  const setStateAndRef = useCallback((state: TState | null, version?: number) => {
    gameStateRef.current = state
    if (version !== undefined) versionRef.current = version
    setGameState(state)
  }, [])

  const subscribeToRoom = useCallback(
    (code: string) => {
      if (!supabase) return
      const { channelPrefix, tableName, stateSchema, broadcast: broadcastCfg } = configRef.current

      dbChannelRef.current?.unsubscribe()
      dbChannelRef.current = supabase
        .channel(`${channelPrefix}-db:${code}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: tableName,
            filter: `code=eq.${code}`,
          },
          (payload) => {
            const parsed = stateSchema.safeParse(payload.new.state)
            if (!parsed.success) {
              console.error(`[${channelPrefix}] Invalid GameState payload:`, parsed.error)
              return
            }
            setStateAndRef(parsed.data, payload.new.version as number)
          }
        )
        .subscribe()

      if (broadcastCfg) {
        broadcastChannelRef.current?.unsubscribe()
        broadcastChannelRef.current = supabase
          .channel(`${broadcastCfg.channelPrefix}:${code}`)
          .on('broadcast', { event: 'game' }, (payload) => {
            if (onBroadcastRef.current) {
              const parsed = broadcastCfg.schema.safeParse(payload.payload)
              if (!parsed.success) {
                console.error(`[${channelPrefix}] Invalid broadcast payload:`, parsed.error)
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
    async (playerName: string) => {
      if (!supabase) return
      const cfg = configRef.current
      setStatus('creating')
      setError(null)

      const id = crypto.randomUUID()
      const code = generateRoomCode()
      const initialState = cfg.createLobbyState({ id, name: playerName, isHost: true as const })

      const { data: inserted, error: err } = await supabase
        .from(cfg.tableName)
        .insert({ code, state: initialState })
        .select('version')

      if (err || !inserted || inserted.length === 0) {
        setError('Failed to create room. Try again.')
        setStatus('error')
        return
      }

      setPlayerId(id)
      setRoomCode(code)
      setStateAndRef(initialState, inserted[0].version as number)
      setStatus('connected')
      saveSession(cfg.sessionKey, { roomCode: code, playerId: id, playerName })
      subscribeToRoom(code)
    },
    [subscribeToRoom, setStateAndRef]
  )

  const joinRoom = useCallback(
    async (code: string, playerName: string) => {
      if (!supabase) return
      const cfg = configRef.current
      setStatus('joining')
      setError(null)

      const normalizedCode = code.trim().toUpperCase()
      const { data, error: err } = await supabase
        .from(cfg.tableName)
        .select('state, version')
        .eq('code', normalizedCode)
        .single()

      if (err || !data) {
        setError('Room not found. Check the code and try again.')
        setStatus('error')
        return
      }

      const parsedCurrent = cfg.stateSchema.safeParse(data.state)
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

      const id = crypto.randomUUID()
      const player = cfg.createPlayer({
        id,
        name: playerName,
        isHost: false,
        playerIndex: currentState.players.length,
      })
      const newState = cfg.addPlayer(currentState, player)

      if (newState.players.length === currentState.players.length) {
        setError('Room is full.')
        setStatus('error')
        return
      }

      const currentVersion = data.version as number
      const { data: updated, error: updateErr } = await supabase
        .from(cfg.tableName)
        .update({ state: newState, version: currentVersion + 1 })
        .eq('code', normalizedCode)
        .eq('version', currentVersion)
        .select('version')

      if (updateErr || !updated || updated.length === 0) {
        setError('Failed to join room. Try again.')
        setStatus('error')
        return
      }

      setPlayerId(id)
      setRoomCode(normalizedCode)
      setStateAndRef(newState, currentVersion + 1)
      setStatus('connected')
      saveSession(cfg.sessionKey, { roomCode: normalizedCode, playerId: id, playerName })
      subscribeToRoom(normalizedCode)
    },
    [subscribeToRoom, setStateAndRef]
  )

  const restoreSession = useCallback(async () => {
    const cfg = configRef.current
    const session = loadSession(cfg.sessionKey)
    if (!session || !supabase) return
    setStatus('restoring')

    const { data } = await supabase
      .from(cfg.tableName)
      .select('state, version')
      .eq('code', session.roomCode)
      .single()

    if (!data) {
      clearSession(cfg.sessionKey)
      setSavedSession(null)
      setStatus('idle')
      return
    }

    const parsedState = cfg.stateSchema.safeParse(data.state)
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
    const stillInGame = state.players.some((p) => p.id === session.playerId)
    if (!stillInGame) {
      clearSession(cfg.sessionKey)
      setSavedSession(null)
      setStatus('idle')
      return
    }

    setPlayerId(session.playerId)
    setRoomCode(session.roomCode)
    setStateAndRef(state, data.version as number)
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

        const { data } = await supabase
          .from(cfg.tableName)
          .update({ state: newState, version: currentVersion + 1 })
          .eq('code', roomCode)
          .eq('version', currentVersion)
          .select('version')

        if (data && data.length > 0) return

        if (attempt < MAX_RETRIES) {
          const { data: fresh } = await supabase
            .from(cfg.tableName)
            .select('state, version')
            .eq('code', roomCode)
            .single()
          if (!fresh) return
          const parsedFresh = cfg.stateSchema.safeParse(fresh.state)
          if (!parsedFresh.success) {
            console.error(
              `[${cfg.channelPrefix}] Invalid GameState in dispatch retry:`,
              parsedFresh.error
            )
            return
          }
          currentState = parsedFresh.data
          currentVersion = fresh.version as number
          setStateAndRef(currentState, currentVersion)
        } else {
          setError('Action failed due to a conflict. Please try again.')
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
          tableName: cfg.tableName,
          applyAction: cfg.applyAction,
          stateSchema: cfg.stateSchema,
        })
      }
    } finally {
      dbChannelRef.current?.unsubscribe()
      dbChannelRef.current = null
      broadcastChannelRef.current?.unsubscribe()
      broadcastChannelRef.current = null
      setStateAndRef(null, 0)
      setPlayerId(null)
      setRoomCode(null)
      setStatus('idle')
      setError(null)
      clearSession(cfg.sessionKey)
      setSavedSession(null)
    }
  }, [roomCode, playerId, setStateAndRef])

  useEffect(() => {
    return () => {
      dbChannelRef.current?.unsubscribe()
      broadcastChannelRef.current?.unsubscribe()
    }
  }, [])

  return {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    savedSession,
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
