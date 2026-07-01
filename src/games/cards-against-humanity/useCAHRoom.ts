'use client'

import {
  createLeaveByRemovingPlayer,
  useGameRoom,
  type UseGameRoomReturn,
} from '@/hooks/useGameRoom'
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
    onBeforeLeave: createLeaveByRemovingPlayer<GameState, GameAction>(),
  })
}
