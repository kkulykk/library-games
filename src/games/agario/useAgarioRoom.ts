'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  addPlayer,
  applyAction,
  assignColor,
  createLobbyState,
  type BroadcastMessage,
  type GameAction,
  type GameState,
  type LobbyPlayer,
} from './logic'

const SESSION_KEY = 'agario_session'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

interface Session {
  roomCode: string
  playerId: string
  playerName: string
  ts: number
}

function saveSession(session: Omit<Session, 'ts'>) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, ts: Date.now() }))
  } catch {}
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data: Session = JSON.parse(raw)
    if (Date.now() - data.ts > SESSION_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {}
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

export type RoomStatus = 'idle' | 'restoring' | 'creating' | 'joining' | 'connected' | 'error'

export interface UseAgarioRoomReturn {
  gameState: GameState | null
  playerId: string | null
  roomCode: string | null
  status: RoomStatus
  error: string | null
  savedSession: Session | null
  createRoom: (playerName: string) => Promise<void>
  joinRoom: (code: string, playerName: string) => Promise<void>
  restoreSession: () => Promise<void>
  dispatch: (action: GameAction) => Promise<void>
  broadcast: (message: BroadcastMessage) => void
  onBroadcast: React.MutableRefObject<((message: BroadcastMessage) => void) | null>
  leaveRoom: () => void
}

export function useAgarioRoom(): UseAgarioRoomReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [status, setStatus] = useState<RoomStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [savedSession, setSavedSession] = useState<Session | null>(null)
  const dbChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const broadcastChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null
  )
  const onBroadcast = useRef<((message: BroadcastMessage) => void) | null>(null)

  useEffect(() => {
    setSavedSession(loadSession())
  }, [])

  function subscribeToRoom(code: string) {
    if (!supabase) return

    // DB channel for lobby state changes
    dbChannelRef.current?.unsubscribe()
    dbChannelRef.current = supabase
      .channel(`agario-db:${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agario_rooms',
          filter: `code=eq.${code}`,
        },
        (payload) => {
          setGameState(payload.new.state as GameState)
        }
      )
      .subscribe()

    // Broadcast channel for real-time game updates (fast, no DB)
    broadcastChannelRef.current?.unsubscribe()
    broadcastChannelRef.current = supabase
      .channel(`agario-game:${code}`)
      .on('broadcast', { event: 'game' }, (payload) => {
        if (onBroadcast.current) {
          onBroadcast.current(payload.payload as BroadcastMessage)
        }
      })
      .subscribe()
  }

  const broadcast = useCallback((message: BroadcastMessage) => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'game',
      payload: message,
    })
  }, [])

  const createRoom = useCallback(async (playerName: string) => {
    if (!supabase) return
    setStatus('creating')
    setError(null)

    const id = crypto.randomUUID()
    const code = generateRoomCode()
    const host: LobbyPlayer = { id, name: playerName, isHost: true, color: assignColor(0) }
    const initialState = createLobbyState(host)

    const { error: err } = await supabase.from('agario_rooms').insert({ code, state: initialState })

    if (err) {
      setError('Failed to create room. Try again.')
      setStatus('error')
      return
    }

    setPlayerId(id)
    setRoomCode(code)
    setGameState(initialState)
    setStatus('connected')
    saveSession({ roomCode: code, playerId: id, playerName })
    subscribeToRoom(code)
  }, [])

  const joinRoom = useCallback(async (code: string, playerName: string) => {
    if (!supabase) return
    setStatus('joining')
    setError(null)

    const normalizedCode = code.trim().toUpperCase()
    const { data, error: err } = await supabase
      .from('agario_rooms')
      .select('state')
      .eq('code', normalizedCode)
      .single()

    if (err || !data) {
      setError('Room not found. Check the code and try again.')
      setStatus('error')
      return
    }

    const currentState = data.state as GameState

    if (currentState.phase !== 'lobby') {
      setError('This game has already started.')
      setStatus('error')
      return
    }

    const id = crypto.randomUUID()
    const player: LobbyPlayer = {
      id,
      name: playerName,
      isHost: false,
      color: assignColor(currentState.players.length),
    }
    const newState = addPlayer(currentState, player)

    if (newState.players.length === currentState.players.length) {
      setError('Room is full.')
      setStatus('error')
      return
    }

    const { error: updateErr } = await supabase
      .from('agario_rooms')
      .update({ state: newState })
      .eq('code', normalizedCode)

    if (updateErr) {
      setError('Failed to join room. Try again.')
      setStatus('error')
      return
    }

    setPlayerId(id)
    setRoomCode(normalizedCode)
    setGameState(newState)
    setStatus('connected')
    saveSession({ roomCode: normalizedCode, playerId: id, playerName })
    subscribeToRoom(normalizedCode)
  }, [])

  const restoreSession = useCallback(async () => {
    const session = loadSession()
    if (!session || !supabase) return
    setStatus('restoring')

    const { data } = await supabase
      .from('agario_rooms')
      .select('state')
      .eq('code', session.roomCode)
      .single()

    if (!data) {
      clearSession()
      setSavedSession(null)
      setStatus('idle')
      return
    }

    const state = data.state as GameState
    const stillInGame = state.players.some((p) => p.id === session.playerId)
    if (!stillInGame) {
      clearSession()
      setSavedSession(null)
      setStatus('idle')
      return
    }

    setPlayerId(session.playerId)
    setRoomCode(session.roomCode)
    setGameState(state)
    setStatus('connected')
    subscribeToRoom(session.roomCode)
  }, [])

  const dispatch = useCallback(
    async (action: GameAction) => {
      if (!gameState || !roomCode || !supabase) return
      const newState = applyAction(gameState, action)
      if (newState === gameState) return
      await supabase.from('agario_rooms').update({ state: newState }).eq('code', roomCode)
    },
    [gameState, roomCode]
  )

  const leaveRoom = useCallback(() => {
    dbChannelRef.current?.unsubscribe()
    dbChannelRef.current = null
    broadcastChannelRef.current?.unsubscribe()
    broadcastChannelRef.current = null
    setGameState(null)
    setPlayerId(null)
    setRoomCode(null)
    setStatus('idle')
    setError(null)
    clearSession()
    setSavedSession(null)
  }, [])

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
    broadcast,
    onBroadcast,
    leaveRoom,
  }
}
