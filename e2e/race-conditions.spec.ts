import type { BrowserContext, Route } from '@playwright/test'
import { fakeSupabaseQuery, test, expect } from './helpers/fakeSupabase'
import { closePlayers, createPlayer } from './helpers/players'
import { SkribblPage, UnoPage } from './pages'

const fakeSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

type QueryPayload = {
  op?: 'select' | 'update' | 'insert'
  table?: string
  values?: {
    state?: unknown
    version?: number
  }
  filters?: Array<{ column: string; value: unknown }>
  columns?: string
  single?: boolean
}

type RoomRow<TState> = {
  state: TState
  version: number
}

type UnoPlayer = {
  id: string
  name: string
  isHost: boolean
  hand: unknown[]
  saidUno: boolean
}

type UnoState = {
  phase: 'lobby' | 'playing' | 'finished'
  players: UnoPlayer[]
  hostId: string
}

type SkribblPlayer = {
  id: string
  name: string
  isHost: boolean
  score: number
  avatar: number
}

type DrawPoint = {
  x: number
  y: number
  color: string
  size: number
  tool: 'pen' | 'eraser'
}

type SkribblMessage = {
  id: string
  playerId: string
  playerName: string
  text: string
  isCorrect?: boolean
  isSystem?: boolean
  isClose?: boolean
}

type SkribblState = {
  phase: 'lobby' | 'picking' | 'drawing' | 'round-end' | 'finished'
  players: SkribblPlayer[]
  currentDrawerIndex: number
  round: number
  totalRounds: number
  word: string | null
  wordChoices: string[]
  hint: string
  strokes: Array<{ points: DrawPoint[] }>
  messages: SkribblMessage[]
  guessedPlayers: string[]
  drawStartTime: number | null
  turnDuration: number
  turnEndTime: number | null
  scoreDeltas: Record<string, number>
}

function hasFilter(payload: QueryPayload, column: string, value: unknown): boolean {
  return (
    payload.filters?.some((filter) => filter.column === column && filter.value === value) ?? false
  )
}

async function installQueryBarrier(
  contexts: BrowserContext[],
  predicate: (payload: QueryPayload) => boolean
): Promise<void> {
  const waiting: Route[] = []
  let released = false

  await Promise.all(
    contexts.map((context) =>
      context.route(`${fakeSupabaseUrl}/query`, async (route) => {
        const payload = route.request().postDataJSON() as QueryPayload

        if (!released && predicate(payload)) {
          waiting.push(route)

          if (waiting.length === contexts.length) {
            released = true
            await Promise.all(waiting.splice(0).map((blocked) => blocked.continue()))
          }

          return
        }

        await route.continue()
      })
    )
  )
}

async function readRoom<TState>(table: string, roomCode: string): Promise<RoomRow<TState>> {
  const selected = await fakeSupabaseQuery<RoomRow<TState>>({
    op: 'select',
    table,
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read ${table} room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateRoom<TState>(
  table: string,
  roomCode: string,
  row: RoomRow<TState>,
  nextState: TState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table,
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update ${table} room ${roomCode}: ${updated.error.message}`)
  }
}

function encodeWord(word: string): string {
  return Buffer.from(word, 'utf8').toString('base64')
}

function seededDrawingState(players: SkribblPlayer[]): SkribblState {
  return {
    phase: 'drawing',
    players,
    currentDrawerIndex: 0,
    round: 1,
    totalRounds: 3,
    word: encodeWord('apple'),
    wordChoices: [],
    hint: '_ _ _ _ _',
    strokes: [],
    messages: [],
    guessedPlayers: [],
    drawStartTime: Date.now(),
    turnDuration: 80,
    turnEndTime: null,
    scoreDeltas: {},
  }
}

test.describe('multiplayer race conditions and reconnect resilience', () => {
  test.setTimeout(60_000)

  test('uno handles concurrent join version conflict without overwriting players', async ({
    page,
    browser,
  }) => {
    const hostName = 'Race Host'
    const hostPage = new UnoPage(page)
    const guestOne = await createPlayer(browser, 'Race Guest One')
    const guestTwo = await createPlayer(browser, 'Race Guest Two')
    const guestOnePage = new UnoPage(guestOne.page)
    const guestTwoPage = new UnoPage(guestTwo.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guestOnePage.goto()
      await guestTwoPage.goto()

      await installQueryBarrier([guestOne.context, guestTwo.context], (payload) => {
        return (
          payload.op === 'select' &&
          payload.table === 'uno_rooms' &&
          payload.single === true &&
          hasFilter(payload, 'code', roomCode)
        )
      })

      await Promise.allSettled([
        guestOnePage.joinRoom(roomCode, guestOne.name),
        guestTwoPage.joinRoom(roomCode, guestTwo.name),
      ])

      const finalRoom = await readRoom<UnoState>('uno_rooms', roomCode)
      const names = finalRoom.state.players.map((player) => player.name)
      const joinedGuestNames = names.filter(
        (name) => name === guestOne.name || name === guestTwo.name
      )

      expect(names).toContain(hostName)
      expect(finalRoom.state.players).toHaveLength(2)
      expect(new Set(names).size).toBe(names.length)
      expect(joinedGuestNames).toHaveLength(1)

      const guestOneJoined = names.includes(guestOne.name)
      const winningGuestName = guestOneJoined ? guestOne.name : guestTwo.name
      const losingGuest = guestOneJoined ? guestTwoPage : guestOnePage
      const winningGuest = guestOneJoined ? guestOnePage : guestTwoPage

      await expect(winningGuest.roomCodeDisplay).toContainText(roomCode)
      await losingGuest.expectError('Failed to join room. Try again.')
      await expect(hostPage.playerRoster).toContainText(winningGuestName)
      await expect(hostPage.playerRoster).not.toContainText(
        guestOneJoined ? guestTwo.name : guestOne.name
      )
    } finally {
      await closePlayers([guestOne, guestTwo])
    }
  })

  test('skribbl retries concurrent correct guesses and preserves both actions', async ({
    page,
    browser,
  }) => {
    const hostName = 'Race Drawer'
    const hostPage = new SkribblPage(page)
    const guesserOne = await createPlayer(browser, 'Race Guess One')
    const guesserTwo = await createPlayer(browser, 'Race Guess Two')
    const guesserOnePage = new SkribblPage(guesserOne.page)
    const guesserTwoPage = new SkribblPage(guesserTwo.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guesserOnePage.goto()
      await guesserOnePage.joinRoom(roomCode, guesserOne.name)

      await guesserTwoPage.goto()
      await guesserTwoPage.joinRoom(roomCode, guesserTwo.name)

      await hostPage.startGame()
      const startedRoom = await readRoom<SkribblState>('skribbl_rooms', roomCode)
      await updateRoom(
        'skribbl_rooms',
        roomCode,
        startedRoom,
        seededDrawingState(startedRoom.state.players)
      )

      await expect(guesserOnePage.hintMask).toContainText('_ _ _ _ _')
      await expect(guesserTwoPage.hintMask).toContainText('_ _ _ _ _')

      await installQueryBarrier([guesserOne.context, guesserTwo.context], (payload) => {
        const state = payload.values?.state as Partial<SkribblState> | undefined
        return (
          payload.op === 'update' &&
          payload.table === 'skribbl_rooms' &&
          hasFilter(payload, 'code', roomCode) &&
          state?.phase === 'drawing' &&
          state.guessedPlayers?.length === 1 &&
          state.messages?.some((message) => message.text.includes('guessed the word')) === true
        )
      })

      await Promise.all([guesserOnePage.submitGuess('apple'), guesserTwoPage.submitGuess('apple')])

      await expect(hostPage.roundEnd).toBeVisible()
      const finalRoom = await readRoom<SkribblState>('skribbl_rooms', roomCode)
      const finalNamesById = new Map(
        finalRoom.state.players.map((player) => [player.name, player.id])
      )

      expect(finalRoom.state.phase).toBe('round-end')
      expect(finalRoom.state.guessedPlayers).toContain(finalNamesById.get(guesserOne.name))
      expect(finalRoom.state.guessedPlayers).toContain(finalNamesById.get(guesserTwo.name))
      expect(new Set(finalRoom.state.guessedPlayers).size).toBe(
        finalRoom.state.guessedPlayers.length
      )
      expect(finalRoom.state.messages.map((message) => message.text)).toEqual(
        expect.arrayContaining([
          `${guesserOne.name} guessed the word!`,
          `${guesserTwo.name} guessed the word!`,
        ])
      )
      await expect(hostPage.roundWord).toContainText('apple')
    } finally {
      await closePlayers([guesserOne, guesserTwo])
    }
  })

  test('uno restored player receives later realtime updates and leave prevents auto-rejoin', async ({
    page,
    browser,
  }) => {
    const hostName = 'Restore Host'
    const hostPage = new UnoPage(page)
    const guest = await createPlayer(browser, 'Restore Guest')
    const guestPage = new UnoPage(guest.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guestPage.goto()
      await guestPage.joinRoom(roomCode, guest.name)

      await guest.page.reload()
      await guestPage.dismissPlayGate()
      const resumeButton = guest.page.getByRole('button', { name: /resume/i })
      await expect(resumeButton.or(guestPage.roomCodeDisplay)).toBeVisible()
      if (!(await guestPage.roomCodeDisplay.isVisible().catch(() => false))) {
        await resumeButton.click()
      }

      await expect(guestPage.roomCodeDisplay).toContainText(roomCode)
      await expect(guestPage.playerRoster).toContainText(hostName)
      await expect(guestPage.playerRoster).toContainText(guest.name)

      await hostPage.startGame()
      await expect(guestPage.status).toBeVisible()

      await guestPage.leaveRoom()
      await guestPage.expectAtEntry()
      await expect
        .poll(() => guest.page.evaluate(() => localStorage.getItem('uno_session')))
        .toBeNull()

      await guest.page.reload()
      await guestPage.dismissPlayGate()
      await guestPage.expectAtEntry()
    } finally {
      await closePlayers([guest])
    }
  })
})
