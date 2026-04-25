import { createRoom, joinRoom, startGame } from '../helpers/assertions'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { gotoGame } from '../helpers/navigation'
import { closePlayers, createPlayer } from '../helpers/players'

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
  messages: Array<{
    id: string
    playerId: string
    playerName: string
    text: string
    isCorrect?: boolean
    isSystem?: boolean
    isClose?: boolean
  }>
  guessedPlayers: string[]
  drawStartTime: number | null
  turnDuration: number
  turnEndTime: number | null
  scoreDeltas: Record<string, number>
}

type SkribblRoomRow = {
  state: SkribblState
  version: number
}

function encodeWord(word: string): string {
  return Buffer.from(word, 'utf8').toString('base64')
}

async function readSkribblRoom(roomCode: string): Promise<SkribblRoomRow> {
  const selected = await fakeSupabaseQuery<SkribblRoomRow>({
    op: 'select',
    table: 'skribbl_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read Skribbl room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateSkribblRoom(
  roomCode: string,
  row: SkribblRoomRow,
  nextState: SkribblState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table: 'skribbl_rooms',
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update Skribbl room ${roomCode}: ${updated.error.message}`)
  }
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
    strokes: [
      {
        points: [
          { x: 100, y: 100, color: '#000000', size: 6, tool: 'pen' },
          { x: 180, y: 160, color: '#000000', size: 6, tool: 'pen' },
        ],
      },
    ],
    messages: [],
    guessedPlayers: [],
    drawStartTime: Date.now(),
    turnDuration: 80,
    turnEndTime: null,
    scoreDeltas: {},
  }
}

test.describe('Skribbl gameplay smoke', () => {
  test('runs a deterministic drawing round and rotates the drawer', async ({ page, browser }) => {
    const host = { page, name: 'Host Skribbl Smoke' }
    const guesserOne = await createPlayer(browser, 'Guesser One')
    const guesserTwo = await createPlayer(browser, 'Guesser Two')

    try {
      await gotoGame(host.page, 'skribbl')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guesserOne.page, 'skribbl')
      await joinRoom(guesserOne.page, roomCode, guesserOne.name)

      await gotoGame(guesserTwo.page, 'skribbl')
      await joinRoom(guesserTwo.page, roomCode, guesserTwo.name)

      await startGame(host.page)

      await expect(host.page.getByTestId('skribbl-word-option')).toHaveCount(3)
      await expect(guesserOne.page.getByTestId('skribbl-waiting-picker')).toContainText(
        /Host Skribbl.*is choosing/
      )

      const startedRoom = await readSkribblRoom(roomCode)
      await updateSkribblRoom(roomCode, startedRoom, seededDrawingState(startedRoom.state.players))

      await expect(host.page.getByTestId('skribbl-drawer-word')).toContainText('apple')
      await expect(guesserOne.page.getByTestId('skribbl-hint-mask')).toContainText('_ _ _ _ _')
      await expect(guesserOne.page.getByTestId('skribbl-drawer-word')).toHaveCount(0)
      await expect(host.page.getByTestId('skribbl-canvas')).toBeVisible()
      await expect(guesserOne.page.getByTestId('skribbl-canvas')).toBeVisible()

      await guesserOne.page.getByTestId('skribbl-guess-input').fill('banana')
      await guesserOne.page.getByTestId('skribbl-guess-input').press('Enter')
      await expect(host.page.getByTestId('skribbl-chat-log')).toContainText('banana')
      await expect(guesserOne.page.getByTestId('skribbl-scoreboard')).not.toContainText('guessed')

      await guesserOne.page.getByTestId('skribbl-guess-input').fill('apple')
      await guesserOne.page.getByTestId('skribbl-guess-input').press('Enter')
      await expect(host.page.getByTestId('skribbl-chat-log')).toContainText(
        `${guesserOne.name} guessed the word!`
      )
      await expect(host.page.getByTestId('skribbl-scoreboard')).toContainText(guesserOne.name)
      await expect(host.page.getByTestId('skribbl-scoreboard')).toContainText('guessed')

      await guesserTwo.page.getByTestId('skribbl-guess-input').fill('apple')
      await guesserTwo.page.getByTestId('skribbl-guess-input').press('Enter')
      await expect(host.page.getByTestId('skribbl-round-end')).toBeVisible()
      await expect(host.page.getByTestId('skribbl-round-word')).toContainText('apple')
      await expect(guesserOne.page.getByTestId('skribbl-round-word')).toContainText('apple')

      await host.page.getByTestId('skribbl-next-turn-button').click()
      await expect(guesserOne.page.getByTestId('skribbl-word-option')).toHaveCount(3)
      await expect(host.page.getByTestId('skribbl-waiting-picker')).toContainText(
        `${guesserOne.name} is choosing`
      )
    } finally {
      await closePlayers([guesserOne, guesserTwo])
    }
  })
})
