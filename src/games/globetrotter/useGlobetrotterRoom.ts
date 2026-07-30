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
import { BroadcastMessageSchema, GameStateSchema, type BroadcastMessage } from './schema'

export type { RoomStatus } from '@/hooks/useGameRoom'

export type UseGlobetrotterRoomReturn = UseGameRoomReturn<GameState, GameAction, BroadcastMessage>

export function useGlobetrotterRoom(): UseGlobetrotterRoomReturn {
  return useGameRoom<GameState, GameAction, BroadcastMessage>({
    tableName: 'globetrotter_rooms',
    channelPrefix: 'globetrotter',
    sessionKey: 'globetrotter_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState({ ...host, score: 0 } as Player),
    createPlayer: ({ id, name, isHost }) => ({ id, name, isHost, score: 0 }) as Player,
    addPlayer,
    broadcast: {
      channelPrefix: 'globetrotter-scout',
      schema: BroadcastMessageSchema,
    },
    onBeforeLeave: createLeaveByRemovingPlayer<GameState, GameAction>(),
  })
}
