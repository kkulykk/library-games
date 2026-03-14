'use client'

import { useGameRoom, type UseGameRoomReturn } from '@/hooks/useGameRoom'
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
import { BroadcastMessageSchema, GameStateSchema } from './schema'

export type { RoomStatus } from '@/hooks/useGameRoom'

export type UseAgarioRoomReturn = UseGameRoomReturn<GameState, GameAction, BroadcastMessage>

export function useAgarioRoom(): UseAgarioRoomReturn {
  return useGameRoom<GameState, GameAction, BroadcastMessage>({
    tableName: 'agario_rooms',
    channelPrefix: 'agario',
    sessionKey: 'agario_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState({ ...host, color: assignColor(0) } as LobbyPlayer),
    createPlayer: ({ id, name, isHost, playerIndex }) =>
      ({ id, name, isHost, color: assignColor(playerIndex) }) as LobbyPlayer,
    addPlayer,
    broadcast: {
      channelPrefix: 'agario-game',
      schema: BroadcastMessageSchema,
    },
  })
}
