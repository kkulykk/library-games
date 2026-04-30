import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { closePlayers, createPlayer } from '../helpers/players'
import { AgarioPage } from '../pages'

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
    const hostName = 'Agario Host'
    const hostPage = new AgarioPage(page)
    const guest = await createPlayer(browser, 'Agario Guest')
    const guestPage = new AgarioPage(guest.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guestPage.goto()
      await guestPage.joinRoom(roomCode, guest.name)

      await hostPage.expectPlayerVisible(hostName)
      await hostPage.expectPlayerVisible(guest.name)
      await guestPage.expectPlayerVisible(hostName)
      await guestPage.expectPlayerVisible(guest.name)

      const lobbyRoom = await readAgarioRoom(roomCode)
      expect(lobbyRoom.state.phase).toBe('lobby')
      expect(lobbyRoom.state.players).toHaveLength(2)

      await hostPage.startGame()
      await broadcastAgario(roomCode, {
        type: 'game_start',
        startTime: Date.now(),
        food: seededFood(),
        nextFoodId: 20,
      })

      await hostPage.expectInGame()
      await guestPage.expectInGame()
      await hostPage.expectLeaderboardContains(hostName)
      await guestPage.expectLeaderboardContains(guest.name)

      await hostPage.canvas.hover()
      await page.mouse.move(500, 350)
      await page.mouse.down()
      await page.mouse.up()

      await guestPage.canvas.hover()
      await guest.page.mouse.move(450, 320)
      await guest.page.keyboard.press('Space')

      await hostPage.expectLeaderboardContains(guest.name, { timeout: 10_000 })
      await guestPage.expectLeaderboardContains(hostName, { timeout: 10_000 })

      await broadcastAgario(roomCode, { type: 'game_end' })

      await hostPage.expectFinished('Game Over')
      await guestPage.expectFinished('Game Over')
      await hostPage.expectFinalScoreContains(hostName)
      await hostPage.expectFinalScoreContains(guest.name)
      await guestPage.expectFinalScoreContains(hostName)
      await guestPage.expectFinalScoreContains(guest.name)

      const finalRoom = await readAgarioRoom(roomCode)
      expect(finalRoom.state.players).toHaveLength(2)
    } finally {
      await closePlayers([guest])
    }
  })
})
