import { createRoom, expectPlayerVisible, joinRoom, startGame } from '../helpers/assertions'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { gotoGame } from '../helpers/navigation'
import { closePlayers, createPlayer } from '../helpers/players'

type AgarioPlayer = {
  id: string
  name: string
  isHost: boolean
  color: string
}

type AgarioState = {
  phase: 'lobby' | 'playing' | 'finished'
  players: AgarioPlayer[]
  hostId: string
}

type AgarioRoomRow = {
  state: AgarioState
  version: number
}

type Position = {
  x: number
  y: number
}

type Food = {
  id: number
  x: number
  y: number
  color: string
  size: number
}

type SnakeState = {
  id: string
  name: string
  color: string
  segments: Position[]
  angle: number
  targetLength: number
  score: number
  alive: boolean
  boosting: boolean
  deathTime: number | null
  foodEaten: number
}

type AgarioBroadcastMessage =
  | { type: 'snake_update'; snake: SnakeState }
  | { type: 'food_sync'; food: Food[]; nextFoodId: number }
  | { type: 'eat_food'; playerId: string; foodIds: number[] }
  | { type: 'snake_killed'; killerId: string; killedId: string }
  | { type: 'death_food'; food: Food[] }
  | { type: 'game_start'; startTime: number; food: Food[]; nextFoodId: number }
  | { type: 'game_end' }

const fakeSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

async function readAgarioRoom(roomCode: string): Promise<AgarioRoomRow> {
  const selected = await fakeSupabaseQuery<AgarioRoomRow>({
    op: 'select',
    table: 'agario_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read Agario room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function broadcastAgario(roomCode: string, payload: AgarioBroadcastMessage): Promise<void> {
  const response = await fetch(`${fakeSupabaseUrl}/broadcast`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channel: `agario-game:${roomCode}`,
      event: 'game',
      payload,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to broadcast Agario message: ${response.status} ${response.statusText}`)
  }
}

function seededFood(count = 20): Food[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    x: 1000 + index * 20,
    y: 1000 + index * 10,
    color: '#39FF14',
    size: 5,
  }))
}

test.describe('Agario gameplay smoke', () => {
  test('starts a realtime snake match, syncs player presence, and finishes for both players', async ({
    page,
    browser,
  }) => {
    const host = { page, name: 'Agario Host' }
    const guest = await createPlayer(browser, 'Agario Guest')

    try {
      await gotoGame(host.page, 'agario')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guest.page, 'agario')
      await joinRoom(guest.page, roomCode, guest.name)

      await expectPlayerVisible(host.page, host.name)
      await expectPlayerVisible(host.page, guest.name)
      await expectPlayerVisible(guest.page, host.name)
      await expectPlayerVisible(guest.page, guest.name)

      const lobbyRoom = await readAgarioRoom(roomCode)
      expect(lobbyRoom.state.phase).toBe('lobby')
      expect(lobbyRoom.state.players).toHaveLength(2)

      await startGame(host.page)
      await broadcastAgario(roomCode, {
        type: 'game_start',
        startTime: Date.now(),
        food: seededFood(),
        nextFoodId: 20,
      })

      await expect(host.page.getByTestId('agario-canvas')).toBeVisible()
      await expect(guest.page.getByTestId('agario-canvas')).toBeVisible()
      await expect(host.page.getByTestId('agario-leaderboard')).toContainText(host.name)
      await expect(guest.page.getByTestId('agario-leaderboard')).toContainText(guest.name)

      const hostCanvas = host.page.getByTestId('agario-canvas')
      const guestCanvas = guest.page.getByTestId('agario-canvas')

      await hostCanvas.hover()
      await host.page.mouse.move(500, 350)
      await host.page.mouse.down()
      await host.page.waitForTimeout(250)
      await host.page.mouse.up()

      await guestCanvas.hover()
      await guest.page.mouse.move(450, 320)
      await guest.page.keyboard.down('Space')
      await guest.page.waitForTimeout(250)
      await guest.page.keyboard.up('Space')

      await expect(host.page.getByTestId('agario-leaderboard')).toContainText(guest.name, {
        timeout: 10_000,
      })
      await expect(guest.page.getByTestId('agario-leaderboard')).toContainText(host.name, {
        timeout: 10_000,
      })

      await broadcastAgario(roomCode, { type: 'game_end' })

      await expect(host.page.getByTestId('agario-finished')).toContainText('Game Over')
      await expect(guest.page.getByTestId('agario-finished')).toContainText('Game Over')
      await expect(host.page.getByTestId('agario-final-scores')).toContainText(host.name)
      await expect(host.page.getByTestId('agario-final-scores')).toContainText(guest.name)
      await expect(guest.page.getByTestId('agario-final-scores')).toContainText(host.name)
      await expect(guest.page.getByTestId('agario-final-scores')).toContainText(guest.name)
    } finally {
      await closePlayers([guest])
    }
  })
})
