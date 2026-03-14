'use client'

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

export type UseUnoRoomReturn = Omit<
  UseGameRoomReturn<GameState, GameAction>,
  'broadcast' | 'onBroadcast'
>

export function useUnoRoom(): UseUnoRoomReturn {
  return useGameRoom<GameState, GameAction>({
    tableName: 'uno_rooms',
    channelPrefix: 'uno',
    sessionKey: 'uno_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState(host as Player),
    createPlayer: ({ id, name, isHost }) => ({ id, name, isHost }) as Player,
    addPlayer,
  })
}
