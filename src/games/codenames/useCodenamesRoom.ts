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

export type UseCodenamesRoomReturn = Omit<
  UseGameRoomReturn<GameState, GameAction>,
  'broadcast' | 'onBroadcast'
>

export function useCodenamesRoom(): UseCodenamesRoomReturn {
  return useGameRoom<GameState, GameAction>({
    tableName: 'codenames_rooms',
    channelPrefix: 'codenames',
    sessionKey: 'codenames_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState(host as Player),
    createPlayer: ({ id, name, isHost }) =>
      ({ id, name, isHost, team: null, role: null }) as Player,
    addPlayer,
  })
}
