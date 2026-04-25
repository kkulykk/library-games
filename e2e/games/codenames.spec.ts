import { createRoom, joinRoom } from '../helpers/assertions'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { gotoGame } from '../helpers/navigation'
import { closePlayers, createPlayer } from '../helpers/players'

type Team = 'red' | 'blue'
type CardType = 'red' | 'blue' | 'neutral' | 'assassin'
type PlayerRole = 'spymaster' | 'operative'

type CodenamesPlayer = {
  id: string
  name: string
  isHost: boolean
  team: Team | null
  role: PlayerRole | null
}

type BoardCard = {
  word: string
  type: CardType
  revealed: boolean
}

type CodenamesState = {
  phase: 'lobby' | 'playing' | 'finished'
  players: CodenamesPlayer[]
  board: BoardCard[]
  currentTeam: Team
  turnPhase: 'giving_clue' | 'guessing'
  currentClue: { word: string; count: number; team: Team; guessesUsed: number } | null
  redRemaining: number
  blueRemaining: number
  winningTeam: Team | null
  log: string[]
}

type CodenamesRoomRow = {
  state: CodenamesState
  version: number
}

async function readCodenamesRoom(roomCode: string): Promise<CodenamesRoomRow> {
  const selected = await fakeSupabaseQuery<CodenamesRoomRow>({
    op: 'select',
    table: 'codenames_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read Codenames room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateCodenamesRoom(
  roomCode: string,
  row: CodenamesRoomRow,
  nextState: CodenamesState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table: 'codenames_rooms',
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update Codenames room ${roomCode}: ${updated.error.message}`)
  }
}

function seededPlayingState(players: CodenamesPlayer[]): CodenamesState {
  const [host, redOperative, blueSpymaster, blueOperative] = players
  const assignedPlayers: CodenamesPlayer[] = [
    { ...host, team: 'red', role: 'spymaster' },
    { ...redOperative, team: 'red', role: 'operative' },
    { ...blueSpymaster, team: 'blue', role: 'spymaster' },
    { ...blueOperative, team: 'blue', role: 'operative' },
  ]
  const board: BoardCard[] = [
    { word: 'APPLE', type: 'red', revealed: false },
    { word: 'OCEAN', type: 'blue', revealed: false },
    { word: 'PAPER', type: 'neutral', revealed: false },
    { word: 'VIPER', type: 'assassin', revealed: false },
    ...Array.from({ length: 21 }, (_, index) => ({
      word: `WORD${index + 1}`,
      type: (index % 2 === 0 ? 'red' : 'blue') as CardType,
      revealed: false,
    })),
  ]

  return {
    phase: 'playing',
    players: assignedPlayers,
    board,
    currentTeam: 'red',
    turnPhase: 'giving_clue',
    currentClue: null,
    redRemaining: board.filter((card) => card.type === 'red').length,
    blueRemaining: board.filter((card) => card.type === 'blue').length,
    winningTeam: null,
    log: ['Game started! RED team goes first.'],
  }
}

test.describe('Codenames gameplay smoke', () => {
  test('gives a clue, guesses correctly, and ends on assassin reveal', async ({
    page,
    browser,
  }) => {
    const host = { page, name: 'Red Spy' }
    const redOperative = await createPlayer(browser, 'Red Op')
    const blueSpymaster = await createPlayer(browser, 'Blue Spy')
    const blueOperative = await createPlayer(browser, 'Blue Op')

    try {
      await gotoGame(host.page, 'codenames')
      const roomCode = await createRoom(host.page, host.name)

      for (const player of [redOperative, blueSpymaster, blueOperative]) {
        await gotoGame(player.page, 'codenames')
        await joinRoom(player.page, roomCode, player.name)
      }

      const createdRoom = await readCodenamesRoom(roomCode)
      await updateCodenamesRoom(
        roomCode,
        createdRoom,
        seededPlayingState(createdRoom.state.players)
      )

      await expect(host.page.getByTestId('codenames-status')).toContainText('Your turn')
      await expect(host.page.getByTestId('codenames-board-card').first()).toContainText('red')
      await expect(redOperative.page.getByTestId('codenames-board-card').first()).not.toContainText(
        'red'
      )

      await host.page.getByTestId('codenames-clue-input').fill('fruit')
      await host.page.getByTestId('codenames-clue-count').selectOption('1')
      await host.page.getByTestId('codenames-send-clue').click()

      await expect(redOperative.page.getByTestId('codenames-status')).toContainText('FRUIT')
      await redOperative.page.getByTestId('codenames-board-card').first().click()
      await expect(host.page.getByTestId('codenames-red-remaining')).toContainText('11')
      await expect(host.page.getByTestId('codenames-log')).toContainText('correct')

      await redOperative.page.getByTestId('codenames-board-card').nth(3).click()
      await expect(host.page.getByTestId('codenames-finished')).toContainText('BLUE team wins')
      await expect(redOperative.page.getByTestId('codenames-finished')).toContainText(
        'BLUE team wins'
      )
    } finally {
      await closePlayers([redOperative, blueSpymaster, blueOperative])
    }
  })
})
