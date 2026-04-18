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

export type UseSkribblRoomReturn = Omit<
  UseGameRoomReturn<GameState, GameAction>,
  'broadcast' | 'onBroadcast'
>

function resolveAvatar(extras?: Record<string, unknown>, playerIndex = 0): number {
  const avatar = extras?.avatar
  if (typeof avatar === 'number' && Number.isInteger(avatar) && avatar >= 0 && avatar <= 7) {
    return avatar
  }
  return playerIndex % 8
}

export function useSkribblRoom(): UseSkribblRoomReturn {
  return useGameRoom<GameState, GameAction>({
    tableName: 'skribbl_rooms',
    channelPrefix: 'skribbl',
    sessionKey: 'skribbl_session',
    stateSchema: GameStateSchema,
    applyAction,
    createLobbyState: (host) => createLobbyState({ ...host, score: 0 } as Player),
    createPlayer: ({ id, name, isHost, playerIndex, extras }) =>
      ({
        id,
        name,
        isHost,
        score: 0,
        avatar: resolveAvatar(extras, playerIndex),
      }) as Player,
    addPlayer,
  })
}
