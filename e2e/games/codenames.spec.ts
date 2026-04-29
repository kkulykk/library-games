import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { closePlayers, createPlayer } from '../helpers/players'
import { CodenamesPage } from '../pages'

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
    const hostName = 'Red Spy'
    const hostPage = new CodenamesPage(page)
    const redOperative = await createPlayer(browser, 'Red Op')
    const blueSpymaster = await createPlayer(browser, 'Blue Spy')
    const blueOperative = await createPlayer(browser, 'Blue Op')
    const redOperativePage = new CodenamesPage(redOperative.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      for (const player of [redOperative, blueSpymaster, blueOperative]) {
        const lobby = new CodenamesPage(player.page)
        await lobby.goto()
        await lobby.joinRoom(roomCode, player.name)
      }

      const createdRoom = await readCodenamesRoom(roomCode)
      await updateCodenamesRoom(
        roomCode,
        createdRoom,
        seededPlayingState(createdRoom.state.players)
      )

      await hostPage.expectStatus('Your turn')
      await expect(hostPage.boardCards.first()).toContainText('red')
      await expect(redOperativePage.boardCards.first()).not.toContainText('red')

      await hostPage.giveClue('fruit', '1')

      await redOperativePage.expectStatus('FRUIT')
      await redOperativePage.revealCard(0)
      await expect(hostPage.redRemaining).toContainText('11')
      await expect(hostPage.log).toContainText('correct')

      await redOperativePage.revealCard(3)
      await hostPage.expectFinished('BLUE team wins')
      await redOperativePage.expectFinished('BLUE team wins')

      const finalRoom = await readCodenamesRoom(roomCode)
      expect(finalRoom.state.phase).toBe('finished')
      expect(finalRoom.state.winningTeam).toBe('blue')
      expect(finalRoom.state.board[3].revealed).toBe(true)
    } finally {
      await closePlayers([redOperative, blueSpymaster, blueOperative])
    }
  })
})
