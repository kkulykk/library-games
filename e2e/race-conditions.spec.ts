import type { BrowserContext, Route } from '@playwright/test'
import { createRoom, joinRoom, startGame } from './helpers/assertions'
import { fakeSupabaseQuery, test, expect } from './helpers/fakeSupabase'
import { gotoGame } from './helpers/navigation'
import { closePlayers, createPlayer } from './helpers/players'

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
    const host = { page, name: 'Race Host' }
    const guestOne = await createPlayer(browser, 'Race Guest One')
    const guestTwo = await createPlayer(browser, 'Race Guest Two')

    try {
      await gotoGame(host.page, 'uno')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guestOne.page, 'uno')
      await gotoGame(guestTwo.page, 'uno')

      await installQueryBarrier([guestOne.context, guestTwo.context], (payload) => {
        return (
          payload.op === 'select' &&
          payload.table === 'uno_rooms' &&
          payload.single === true &&
          hasFilter(payload, 'code', roomCode)
        )
      })

      await Promise.allSettled([
        joinRoom(guestOne.page, roomCode, guestOne.name),
        joinRoom(guestTwo.page, roomCode, guestTwo.name),
      ])

      const finalRoom = await readRoom<UnoState>('uno_rooms', roomCode)
      const names = finalRoom.state.players.map((player) => player.name)
      const joinedGuestNames = names.filter(
        (name) => name === guestOne.name || name === guestTwo.name
      )

      expect(names).toContain(host.name)
      expect(finalRoom.state.players).toHaveLength(2)
      expect(new Set(names).size).toBe(names.length)
      expect(joinedGuestNames).toHaveLength(1)

      const guestOneJoined = names.includes(guestOne.name)
      const winningGuest = guestOneJoined ? guestOne : guestTwo
      const losingGuest = guestOneJoined ? guestTwo : guestOne

      await expect(winningGuest.page.getByTestId('room-code')).toContainText(roomCode)
      await expect(losingGuest.page.getByTestId('room-error')).toContainText(
        'Failed to join room. Try again.'
      )
      await expect(host.page.getByTestId('player-roster')).toContainText(winningGuest.name)
      await expect(host.page.getByTestId('player-roster')).not.toContainText(losingGuest.name)
    } finally {
      await closePlayers([guestOne, guestTwo])
    }
  })

  test('skribbl retries concurrent correct guesses and preserves both actions', async ({
    page,
    browser,
  }) => {
    const host = { page, name: 'Race Drawer' }
    const guesserOne = await createPlayer(browser, 'Race Guess One')
    const guesserTwo = await createPlayer(browser, 'Race Guess Two')

    try {
      await gotoGame(host.page, 'skribbl')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guesserOne.page, 'skribbl')
      await joinRoom(guesserOne.page, roomCode, guesserOne.name)

      await gotoGame(guesserTwo.page, 'skribbl')
      await joinRoom(guesserTwo.page, roomCode, guesserTwo.name)

      await startGame(host.page)
      const startedRoom = await readRoom<SkribblState>('skribbl_rooms', roomCode)
      await updateRoom(
        'skribbl_rooms',
        roomCode,
        startedRoom,
        seededDrawingState(startedRoom.state.players)
      )

      await expect(guesserOne.page.getByTestId('skribbl-hint-mask')).toContainText('_ _ _ _ _')
      await expect(guesserTwo.page.getByTestId('skribbl-hint-mask')).toContainText('_ _ _ _ _')

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

      await Promise.all([
        guesserOne.page
          .getByTestId('skribbl-guess-input')
          .fill('apple')
          .then(() => guesserOne.page.getByTestId('skribbl-guess-input').press('Enter')),
        guesserTwo.page
          .getByTestId('skribbl-guess-input')
          .fill('apple')
          .then(() => guesserTwo.page.getByTestId('skribbl-guess-input').press('Enter')),
      ])

      await expect(host.page.getByTestId('skribbl-round-end')).toBeVisible()
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
      await expect(host.page.getByTestId('skribbl-round-word')).toContainText('apple')
    } finally {
      await closePlayers([guesserOne, guesserTwo])
    }
  })

  test('uno restored player receives later realtime updates and leave prevents auto-rejoin', async ({
    page,
    browser,
  }) => {
    const host = { page, name: 'Restore Host' }
    const guest = await createPlayer(browser, 'Restore Guest')

    try {
      await gotoGame(host.page, 'uno')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guest.page, 'uno')
      await joinRoom(guest.page, roomCode, guest.name)

      await guest.page.reload()
      const playButton = guest.page.getByTestId('play-game-button')
      if (await playButton.isVisible().catch(() => false)) {
        await playButton.click()
      }
      const resumeButton = guest.page.getByRole('button', { name: /resume/i })
      await expect(resumeButton.or(guest.page.getByTestId('room-code'))).toBeVisible()
      if (
        !(await guest.page
          .getByTestId('room-code')
          .isVisible()
          .catch(() => false))
      ) {
        await resumeButton.click()
      }

      await expect(guest.page.getByTestId('room-code')).toContainText(roomCode)
      await expect(guest.page.getByTestId('player-roster')).toContainText(host.name)
      await expect(guest.page.getByTestId('player-roster')).toContainText(guest.name)

      await startGame(host.page)
      await expect(guest.page.getByTestId('uno-status')).toBeVisible()

      await guest.page.getByTestId('leave-room-button').click()
      await expect(
        guest.page.getByTestId('create-room-button').filter({ visible: true }).first()
      ).toBeVisible()
      await expect
        .poll(() => guest.page.evaluate(() => localStorage.getItem('uno_session')))
        .toBeNull()

      await guest.page.reload()
      if (await playButton.isVisible().catch(() => false)) {
        await playButton.click()
      }
      await expect(guest.page.getByTestId('room-code')).toHaveCount(0)
      await expect(
        guest.page.getByTestId('create-room-button').filter({ visible: true }).first()
      ).toBeVisible()
    } finally {
      await closePlayers([guest])
    }
  })
})
