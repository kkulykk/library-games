'use client'

import { useGameRoom, type UseGameRoomReturn } from '@/hooks/useGameRoom'
import {
  addPlayer,
  applyAction,
  createLobbyState,
  redactForPlayer,
  type GameAction,
  type GameState,
  type Player,
} from './logic'
import { GameStateSchema } from './schema'

export type { RoomStatus } from '@/hooks/useGameRoom'

export type UseMindmeldRoomReturn = Omit<
  UseGameRoomReturn<GameState, GameAction>,
  'broadcast' | 'onBroadcast'
>

export function useMindmeldRoom(): UseMindmeldRoomReturn {
  return useGameRoom<GameState, GameAction>({
    tableName: 'mindmeld_rooms',
    channelPrefix: 'mindmeld',
    sessionKey: 'mindmeld_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState({ ...host, score: 0 } as Player),
    createPlayer: ({ id, name, isHost }) => ({ id, name, isHost, score: 0 }) as Player,
    addPlayer,
    leaveAction: (_state, playerId) => ({ type: 'REMOVE_PLAYER', playerId }) as GameAction,
    redact: redactForPlayer,
  })
}
