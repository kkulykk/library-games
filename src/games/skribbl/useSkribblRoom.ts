'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  addPlayer,
  applyAction,
  createLobbyState,
  type GameAction,
  type GameState,
  type Player,
} from './logic'

const SESSION_KEY = 'skribbl_session'
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

export interface UseSkribblRoomReturn {
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
  leaveRoom: () => void
}

export function useSkribblRoom(): UseSkribblRoomReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [status, setStatus] = useState<RoomStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [savedSession, setSavedSession] = useState<Session | null>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const gameStateRef = useRef<GameState | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    setSavedSession(loadSession())
  }, [])

  function setStateAndRef(state: GameState | null, version?: number) {
    gameStateRef.current = state
    if (version !== undefined) versionRef.current = version
    setGameState(state)
  }

  function subscribeToRoom(code: string) {
    if (!supabase) return
    channelRef.current?.unsubscribe()
    channelRef.current = supabase
      .channel(`skribbl:${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'skribbl_rooms',
          filter: `code=eq.${code}`,
        },
        (payload) => {
          setStateAndRef(payload.new.state as GameState, payload.new.version as number)
        }
      )
      .subscribe()
  }

  const createRoom = useCallback(async (playerName: string) => {
    if (!supabase) return
    setStatus('creating')
    setError(null)

    const id = crypto.randomUUID()
    const code = generateRoomCode()
    const host: Player = { id, name: playerName, isHost: true, score: 0 }
    const initialState = createLobbyState(host)

    const { error: err } = await supabase
      .from('skribbl_rooms')
      .insert({ code, state: initialState })

    if (err) {
      setError('Failed to create room. Try again.')
      setStatus('error')
      return
    }

    setPlayerId(id)
    setRoomCode(code)
    setStateAndRef(initialState, 1)
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
      .from('skribbl_rooms')
      .select('state, version')
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
    const player: Player = { id, name: playerName, isHost: false, score: 0 }
    const newState = addPlayer(currentState, player)

    if (newState.players.length === currentState.players.length) {
      setError('Room is full.')
      setStatus('error')
      return
    }

    const currentVersion = data.version as number
    const { data: updated, error: updateErr } = await supabase
      .from('skribbl_rooms')
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
    saveSession({ roomCode: normalizedCode, playerId: id, playerName })
    subscribeToRoom(normalizedCode)
  }, [])

  const restoreSession = useCallback(async () => {
    const session = loadSession()
    if (!session || !supabase) return
    setStatus('restoring')

    const { data } = await supabase
      .from('skribbl_rooms')
      .select('state, version')
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
    setStateAndRef(state, data.version as number)
    setStatus('connected')
    subscribeToRoom(session.roomCode)
  }, [])

  const dispatch = useCallback(
    async (action: GameAction) => {
      if (!roomCode || !supabase) return

      const MAX_RETRIES = 3
      let currentState = gameStateRef.current
      let currentVersion = versionRef.current

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (!currentState) return
        const newState = applyAction(currentState, action)
        if (newState === currentState) return

        const { data } = await supabase
          .from('skribbl_rooms')
          .update({ state: newState, version: currentVersion + 1 })
          .eq('code', roomCode)
          .eq('version', currentVersion)
          .select('version')

        if (data && data.length > 0) return

        if (attempt < MAX_RETRIES) {
          const { data: fresh } = await supabase
            .from('skribbl_rooms')
            .select('state, version')
            .eq('code', roomCode)
            .single()
          if (!fresh) return
          currentState = fresh.state as GameState
          currentVersion = fresh.version as number
          setStateAndRef(currentState, currentVersion)
        } else {
          setError('Action failed due to a conflict. Please try again.')
        }
      }
    },
    [roomCode]
  )

  const leaveRoom = useCallback(() => {
    channelRef.current?.unsubscribe()
    channelRef.current = null
    setStateAndRef(null, 0)
    setPlayerId(null)
    setRoomCode(null)
    setStatus('idle')
    setError(null)
    clearSession()
    setSavedSession(null)
  }, [])

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe()
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
  }
}
