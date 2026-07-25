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

export type UseGlobetrotterRoomReturn = Omit<
  UseGameRoomReturn<GameState, GameAction>,
  'broadcast' | 'onBroadcast'
>

export function useGlobetrotterRoom(): UseGlobetrotterRoomReturn {
  return useGameRoom<GameState, GameAction>({
    tableName: 'globetrotter_rooms',
    channelPrefix: 'globetrotter',
    sessionKey: 'globetrotter_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState({ ...host, score: 0 } as Player),
    createPlayer: ({ id, name, isHost }) => ({ id, name, isHost, score: 0 }) as Player,
    addPlayer,
    onBeforeLeave: createLeaveByRemovingPlayer<GameState, GameAction>(),
  })
}
