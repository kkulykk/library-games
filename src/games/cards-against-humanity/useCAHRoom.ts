'use client'

import { supabase } from '@/lib/supabase'
import { useGameRoom, type UseGameRoomReturn } from '@/hooks/useGameRoom'
import {
  addPlayer,
  applyAction,
  createLobbyState,
  type GameAction,
  type GameState,
  type Player,
} from './logic'
import { GameStateSchema } from './schema'

export type { RoomStatus } from '@/hooks/useGameRoom'

export type UseCAHRoomReturn = Omit<
  UseGameRoomReturn<GameState, GameAction>,
  'broadcast' | 'onBroadcast'
>

export function useCAHRoom(): UseCAHRoomReturn {
  return useGameRoom<GameState, GameAction>({
    tableName: 'cah_rooms',
    channelPrefix: 'cah',
    sessionKey: 'cah_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState(host as Player),
    createPlayer: ({ id, name, isHost }) => ({ id, name, isHost }) as Player,
    addPlayer,
    onBeforeLeave: async ({ gameState, roomCode, playerId, applyAction: apply, stateSchema }) => {
      if (!gameState || !roomCode || !playerId || !supabase) return

      const MAX_RETRIES = 3
      let currentState: GameState | null = gameState
      let currentVersion = 0

      // Fetch current version
      const { data: initial } = await supabase
        .from('cah_rooms')
        .select('version')
        .eq('code', roomCode)
        .single()
      if (!initial) return
      currentVersion = initial.version as number

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (!currentState) break
        const newState = apply(currentState, { type: 'REMOVE_PLAYER', playerId } as GameAction)
        if (newState === currentState) break

        const { data } = await supabase
          .from('cah_rooms')
          .update({ state: newState, version: currentVersion + 1 })
          .eq('code', roomCode)
          .eq('version', currentVersion)
          .select('version')

        if (data && data.length > 0) break

        if (attempt < MAX_RETRIES) {
          const { data: fresh } = await supabase
            .from('cah_rooms')
            .select('state, version')
            .eq('code', roomCode)
            .single()
          if (!fresh) break
          const parsedFresh = stateSchema.safeParse(fresh.state)
          if (!parsedFresh.success) {
            console.error('[cah] Invalid GameState in leaveRoom retry:', parsedFresh.error)
            break
          }
          currentState = parsedFresh.data
          currentVersion = fresh.version as number
        }
      }
    },
  })
}
