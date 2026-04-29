import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { closePlayers, createPlayer } from '../helpers/players'
import { SkribblPage } from '../pages'

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
    const hostName = 'Host Skribbl Smoke'
    const hostPage = new SkribblPage(page)
    const guesserOne = await createPlayer(browser, 'Guesser One')
    const guesserTwo = await createPlayer(browser, 'Guesser Two')
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

      await expect(hostPage.wordOptions).toHaveCount(3)
      await guesserOnePage.expectWaitingFor(/Host Skribbl.*is choosing/)

      const startedRoom = await readSkribblRoom(roomCode)
      await updateSkribblRoom(roomCode, startedRoom, seededDrawingState(startedRoom.state.players))

      await expect(hostPage.drawerWord).toContainText('apple')
      await expect(guesserOnePage.hintMask).toContainText('_ _ _ _ _')
      await expect(guesserOnePage.drawerWord).toHaveCount(0)
      await expect(hostPage.canvas).toBeVisible()
      await expect(guesserOnePage.canvas).toBeVisible()

      await guesserOnePage.submitGuess('banana')
      await hostPage.expectChatContains('banana')
      await expect(guesserOnePage.scoreboard).not.toContainText('guessed')

      await guesserOnePage.submitGuess('apple')
      await hostPage.expectChatContains(`${guesserOne.name} guessed the word!`)
      await expect(hostPage.scoreboard).toContainText(guesserOne.name)
      await expect(hostPage.scoreboard).toContainText('guessed')

      await guesserTwoPage.submitGuess('apple')
      await expect(hostPage.roundEnd).toBeVisible()
      await expect(hostPage.roundWord).toContainText('apple')
      await expect(guesserOnePage.roundWord).toContainText('apple')

      const finalRoom = await readSkribblRoom(roomCode)
      expect(finalRoom.state.phase).toBe('round-end')
      const finalIds = new Map(finalRoom.state.players.map((p) => [p.name, p.id]))
      expect(finalRoom.state.guessedPlayers).toContain(finalIds.get(guesserOne.name))
      expect(finalRoom.state.guessedPlayers).toContain(finalIds.get(guesserTwo.name))

      await hostPage.advanceToNextTurn()
      await expect(guesserOnePage.wordOptions).toHaveCount(3)
      await hostPage.expectWaitingFor(`${guesserOne.name} is choosing`)
    } finally {
      await closePlayers([guesserOne, guesserTwo])
    }
  })
})
