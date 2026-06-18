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
    onBeforeLeave: async ({
      gameState,
      roomCode,
      playerId,
      roomToken,
      applyAction: apply,
      stateSchema,
    }) => {
      if (!gameState || !roomCode || !playerId || !supabase) return

      const MAX_RETRIES = 3
      let currentState: GameState | null = gameState

      // Post-seal, direct .from() is RLS default-denied; read the live version through the
      // code-gated get_cah RPC (D-01). No row means the room is already gone — nothing to leave.
      const { data: initial } = await supabase.rpc('get_cah', { p_code: roomCode })
      const initialRow = initial && initial.length > 0 ? initial[0] : null
      if (!initialRow) return
      let currentVersion = initialRow.version as number

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (!currentState) break
        const newState = apply(currentState, { type: 'REMOVE_PLAYER', playerId } as GameAction)
        if (newState === currentState) break

        // Token-gated write through dispatch_cah (ACCESS-02/ACCESS-03): server CAS on
        // p_expected_version, 42501 on bad/missing token (terminal), 40001/empty on conflict.
        const { data, error: dispatchErr } = await supabase.rpc('dispatch_cah', {
          p_code: roomCode,
          p_room_token: roomToken,
          p_new_state: newState,
          p_expected_version: currentVersion,
        })

        if (data && data.length > 0) break
        // Bad/missing token is terminal — no retry can fix it.
        if (dispatchErr?.code === '42501') break

        if (attempt < MAX_RETRIES) {
          const { data: fresh } = await supabase.rpc('get_cah', { p_code: roomCode })
          const freshRow = fresh && fresh.length > 0 ? fresh[0] : null
          if (!freshRow) break
          const parsedFresh = stateSchema.safeParse(freshRow.state)
          if (!parsedFresh.success) {
            console.error('[cah] Invalid GameState in leaveRoom retry:', parsedFresh.error)
            break
          }
          currentState = parsedFresh.data
          currentVersion = freshRow.version as number
        }
      }
    },
  })
}
